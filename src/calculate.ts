import type {
    BootstrapElement,
    EnrichedStandingRow,
    EntryPick,
    EntryPicksResponse,
    EventLiveResponse,
    FixtureResponseItem,
    LeagueStandingRow,
} from './types';

interface CalculationContext {
    standing: LeagueStandingRow;
    picksResponse: EntryPicksResponse;
    bootstrapElements: Map<number, BootstrapElement>;
    liveElements: Map<number, EventLiveResponse['elements'][number]>;
    teamFixtures: Map<number, FixtureResponseItem[]>;
}

const GOALKEEPER = 1;
const DEFENDER = 2;
const FORWARD = 4;

type ResolvedPick = EntryPick;

function isStartingPick(pick: EntryPick): boolean {
    return pick.position >= 1 && pick.position <= 11;
}

function isBenchPick(pick: EntryPick): boolean {
    return pick.position >= 12 && pick.position <= 15;
}

function isScoringPick(pick: EntryPick): boolean {
    return pick.multiplier > 0;
}

function getEffectiveSlotWeight(pick: EntryPick): number {
    return Math.max(1, pick.multiplier);
}

function getElementType(
    pick: EntryPick,
    bootstrapElements: Map<number, BootstrapElement>,
): number | null {
    return pick.element_type ?? bootstrapElements.get(pick.element)?.element_type ?? null;
}

function getTeamFixturesForPick(
    pick: EntryPick,
    bootstrapElements: Map<number, BootstrapElement>,
    teamFixtures: Map<number, FixtureResponseItem[]>,
): FixtureResponseItem[] {
    const player = bootstrapElements.get(pick.element);
    if (!player) {
        return [];
    }

    return teamFixtures.get(player.team) ?? [];
}

function didPlayerRecordMinutes(
    pick: EntryPick,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
): boolean {
    return (liveElements.get(pick.element)?.stats.minutes ?? 0) > 0;
}

function isDefiniteNoShow(
    pick: EntryPick,
    bootstrapElements: Map<number, BootstrapElement>,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
    teamFixtures: Map<number, FixtureResponseItem[]>,
): boolean {
    if (didPlayerRecordMinutes(pick, liveElements)) {
        return false;
    }

    const fixtures = getTeamFixturesForPick(pick, bootstrapElements, teamFixtures);
    if (fixtures.length === 0) {
        return true;
    }

    return fixtures.every((fixture) => fixture.finished);
}

function isBenchPlayerEligibleForAutoSub(
    pick: EntryPick,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
): boolean {
    return didPlayerRecordMinutes(pick, liveElements);
}

function countLineupByElementType(
    picks: EntryPick[],
    bootstrapElements: Map<number, BootstrapElement>,
): Map<number, number> {
    const counts = new Map<number, number>();

    for (const pick of picks) {
        const elementType = getElementType(pick, bootstrapElements);
        if (!elementType) {
            continue;
        }

        counts.set(elementType, (counts.get(elementType) ?? 0) + 1);
    }

    return counts;
}

function hasValidFormation(
    picks: EntryPick[],
    bootstrapElements: Map<number, BootstrapElement>,
): boolean {
    const counts = countLineupByElementType(picks, bootstrapElements);
    return (counts.get(GOALKEEPER) ?? 0) === 1
        && (counts.get(DEFENDER) ?? 0) >= 3
        && (counts.get(FORWARD) ?? 0) >= 1;
}

function createSubstitutedPick(benchPick: EntryPick, starterPosition: number): EntryPick {
    return {
        ...benchPick,
        position: starterPosition,
        multiplier: 1,
        is_captain: false,
        is_vice_captain: false,
    };
}

function getCandidateStarterIndexesForBenchPick(
    lineup: EntryPick[],
    benchPick: EntryPick,
    bootstrapElements: Map<number, BootstrapElement>,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
    teamFixtures: Map<number, FixtureResponseItem[]>,
): number[] {
    const benchElementType = getElementType(benchPick, bootstrapElements);

    return lineup
        .map((pick, index) => ({ pick, index }))
        .filter(({ pick }) => {
            if (!isStartingPick(pick)) {
                return false;
            }

            const elementType = getElementType(pick, bootstrapElements);
            return elementType !== GOALKEEPER
                && isDefiniteNoShow(pick, bootstrapElements, liveElements, teamFixtures);
        })
        .sort((left, right) => {
            const leftType = getElementType(left.pick, bootstrapElements);
            const rightType = getElementType(right.pick, bootstrapElements);
            const leftSameType = leftType === benchElementType ? 1 : 0;
            const rightSameType = rightType === benchElementType ? 1 : 0;

            if (leftSameType !== rightSameType) {
                return rightSameType - leftSameType;
            }

            return left.pick.position - right.pick.position;
        })
        .map(({ index }) => index);
}

function applyAutoSubs(
    picks: EntryPick[],
    bootstrapElements: Map<number, BootstrapElement>,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
    teamFixtures: Map<number, FixtureResponseItem[]>,
): ResolvedPick[] {
    const lineup = picks
        .filter(isStartingPick)
        .sort((left, right) => left.position - right.position)
        .map((pick) => ({ ...pick }));
    const bench = picks
        .filter(isBenchPick)
        .sort((left, right) => left.position - right.position)
        .map((pick) => ({ ...pick }));

    const startingGoalkeeperIndex = lineup.findIndex((pick) => getElementType(pick, bootstrapElements) === GOALKEEPER);
    const benchGoalkeeper = bench.find((pick) => getElementType(pick, bootstrapElements) === GOALKEEPER);

    if (
        startingGoalkeeperIndex >= 0
        && benchGoalkeeper
        && isDefiniteNoShow(lineup[startingGoalkeeperIndex], bootstrapElements, liveElements, teamFixtures)
        && isBenchPlayerEligibleForAutoSub(benchGoalkeeper, liveElements)
    ) {
        lineup[startingGoalkeeperIndex] = createSubstitutedPick(benchGoalkeeper, lineup[startingGoalkeeperIndex].position);
    }

    const outfieldBench = bench.filter((pick) => getElementType(pick, bootstrapElements) !== GOALKEEPER);

    for (const benchPick of outfieldBench) {
        if (!isBenchPlayerEligibleForAutoSub(benchPick, liveElements)) {
            continue;
        }

        const candidateIndexes = getCandidateStarterIndexesForBenchPick(
            lineup,
            benchPick,
            bootstrapElements,
            liveElements,
            teamFixtures,
        );

        for (const candidateIndex of candidateIndexes) {
            const replaced = lineup[candidateIndex];
            const nextLineup = [...lineup];
            nextLineup[candidateIndex] = createSubstitutedPick(benchPick, replaced.position);

            if (!hasValidFormation(nextLineup, bootstrapElements)) {
                continue;
            }

            lineup[candidateIndex] = nextLineup[candidateIndex];
            break;
        }
    }

    return lineup;
}

function getChipBaseMultiplier(
    pick: EntryPick,
    activeChip: string | null,
    bootstrapElements: Map<number, BootstrapElement>,
    originalCaptain: EntryPick | undefined,
    originalViceCaptain: EntryPick | undefined,
): number {
    if (activeChip === 'pdbus') {
        return getElementType(pick, bootstrapElements) === DEFENDER ? 2 : 1;
    }

    if (activeChip === '2capt') {
        if (pick.element === originalCaptain?.element) {
            return 3;
        }

        if (pick.element === originalViceCaptain?.element) {
            return 2;
        }
    }

    return 1;
}

function applyFinalMultipliers(
    lineup: ResolvedPick[],
    picksResponse: EntryPicksResponse,
    bootstrapElements: Map<number, BootstrapElement>,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
    teamFixtures: Map<number, FixtureResponseItem[]>,
): ResolvedPick[] {
    const originalCaptain = picksResponse.picks.find((pick) => pick.is_captain);
    const originalViceCaptain = picksResponse.picks.find((pick) => pick.is_vice_captain);
    const captainIsDefiniteNoShow = originalCaptain
        ? isDefiniteNoShow(originalCaptain, bootstrapElements, liveElements, teamFixtures)
        : false;
    const viceCanTakeCaptaincy = Boolean(
        originalViceCaptain
        && didPlayerRecordMinutes(originalViceCaptain, liveElements)
        && lineup.some((pick) => pick.element === originalViceCaptain.element),
    );
    const promoteViceCaptain = picksResponse.active_chip !== 'pdbus'
        && captainIsDefiniteNoShow
        && viceCanTakeCaptaincy;

    return lineup.map((pick) => {
        let multiplier = getChipBaseMultiplier(
            pick,
            picksResponse.active_chip,
            bootstrapElements,
            originalCaptain,
            originalViceCaptain,
        );

        if (picksResponse.active_chip !== 'pdbus') {
            if (promoteViceCaptain) {
                if (pick.element === originalViceCaptain?.element) {
                    multiplier = Math.max(multiplier, 2);
                }
            } else if (pick.element === originalCaptain?.element) {
                multiplier = Math.max(multiplier, 2);
            }
        }

        return {
            ...pick,
            multiplier,
            is_captain: promoteViceCaptain ? pick.element === originalViceCaptain?.element : pick.element === originalCaptain?.element,
            is_vice_captain: pick.element === originalViceCaptain?.element,
        };
    });
}

function resolveEffectiveLineup(
    picksResponse: EntryPicksResponse,
    bootstrapElements: Map<number, BootstrapElement>,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
    teamFixtures: Map<number, FixtureResponseItem[]>,
): ResolvedPick[] {
    const autoSubbedLineup = applyAutoSubs(
        picksResponse.picks,
        bootstrapElements,
        liveElements,
        teamFixtures,
    );

    return applyFinalMultipliers(
        autoSubbedLineup,
        picksResponse,
        bootstrapElements,
        liveElements,
        teamFixtures,
    );
}

function getCompletedFixtureCount(
    pick: EntryPick,
    bootstrapElements: Map<number, BootstrapElement>,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
    teamFixtures: Map<number, FixtureResponseItem[]>,
): number {
    const fixtures = getTeamFixturesForPick(pick, bootstrapElements, teamFixtures);
    if (fixtures.length === 0) {
        return 0;
    }

    const live = liveElements.get(pick.element);
    const finishedFixtures = fixtures.filter((fixture) => fixture.finished).length;
    const hasInProgressFixture = fixtures.some((fixture) => fixture.started && !fixture.finished);
    const hasPlayedInProgressFixture = Boolean(live && live.stats.minutes > 0 && hasInProgressFixture);

    return Math.min(fixtures.length, finishedFixtures + (hasPlayedInProgressFixture ? 1 : 0));
}

export function buildTeamFixtureMap(fixtures: FixtureResponseItem[]): Map<number, FixtureResponseItem[]> {
    const map = new Map<number, FixtureResponseItem[]>();

    for (const fixture of fixtures) {
        map.set(fixture.team_h, [...(map.get(fixture.team_h) ?? []), fixture]);
        map.set(fixture.team_a, [...(map.get(fixture.team_a) ?? []), fixture]);
    }

    return map;
}

export function calculateEnhancedStandingRow({
    standing,
    picksResponse,
    bootstrapElements,
    liveElements,
    teamFixtures,
}: CalculationContext): EnrichedStandingRow {
    const scoringPicks = resolveEffectiveLineup(
        picksResponse,
        bootstrapElements,
        liveElements,
        teamFixtures,
    ).filter(isScoringPick);

    let playedBudget = 0;
    let totalStarterBudget = 0;
    let livePoints = 0;
    let startersPlayed = 0;

    for (const pick of scoringPicks) {
        const player = bootstrapElements.get(pick.element);
        const live = liveElements.get(pick.element);
        const slotWeight = getEffectiveSlotWeight(pick);
        const fixtureCount = getTeamFixturesForPick(pick, bootstrapElements, teamFixtures).length;
        const completedFixtureCount = getCompletedFixtureCount(pick, bootstrapElements, liveElements, teamFixtures);

        if (player) {
            totalStarterBudget += (player.now_cost / 10) * slotWeight * fixtureCount;
        }

        if (completedFixtureCount > 0 && player) {
            playedBudget += (player.now_cost / 10) * slotWeight * completedFixtureCount;
            startersPlayed += slotWeight * completedFixtureCount;
        }

        if (live) {
            livePoints += live.stats.total_points * slotWeight;
        }
    }

    const pointsPerMillion = playedBudget > 0 ? livePoints / playedBudget : 0;
    const remainingBudget = Math.max(0, totalStarterBudget - playedBudget);

    return {
        rank: standing.rank,
        lastRank: standing.last_rank,
        overallPoints: standing.total,
        eventPoints: standing.event_total,
        entryId: standing.entry,
        entryName: standing.entry_name,
        managerName: standing.player_name,
        playedBudget,
        totalStarterBudget,
        remainingBudget,
        livePoints,
        pointsPerMillion,
        projectedEventPoints: livePoints,
        projectedSeasonTotal: standing.total - standing.event_total + livePoints,
        startersPlayed,
        startersTotal: scoringPicks.reduce((total, pick) => {
            const slotWeight = getEffectiveSlotWeight(pick);
            const fixtureCount = getTeamFixturesForPick(pick, bootstrapElements, teamFixtures).length;
            return total + (slotWeight * fixtureCount);
        }, 0),
    };
}
