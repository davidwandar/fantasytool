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

function isScoringPick(pick: EntryPick): boolean {
    return pick.multiplier > 0;
}

function getEffectiveSlotWeight(pick: EntryPick): number {
    return Math.max(1, pick.multiplier);
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
    const scoringPicks = picksResponse.picks.filter(isScoringPick);

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
