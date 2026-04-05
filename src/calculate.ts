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
    teamFixtures: Map<number, FixtureResponseItem>;
}

function isStarter(pick: EntryPick): boolean {
    return pick.position >= 1 && pick.position <= 11;
}

function getEffectiveSlotWeight(pick: EntryPick): number {
    return Math.max(1, pick.multiplier);
}

function didStarterConsumeBudget(
    pick: EntryPick,
    bootstrapElements: Map<number, BootstrapElement>,
    liveElements: Map<number, EventLiveResponse['elements'][number]>,
    teamFixtures: Map<number, FixtureResponseItem>,
): boolean {
    const player = bootstrapElements.get(pick.element);
    if (!player) {
        return false;
    }

    const live = liveElements.get(pick.element);
    if (live && live.stats.minutes > 0) {
        return true;
    }

    const fixture = teamFixtures.get(player.team);
    return Boolean(fixture?.finished);
}

export function buildTeamFixtureMap(fixtures: FixtureResponseItem[]): Map<number, FixtureResponseItem> {
    const map = new Map<number, FixtureResponseItem>();

    for (const fixture of fixtures) {
        map.set(fixture.team_h, fixture);
        map.set(fixture.team_a, fixture);
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
    const starters = picksResponse.picks.filter(isStarter);

    let playedBudget = 0;
    let totalStarterBudget = 0;
    let livePoints = 0;
    let startersPlayed = 0;

    for (const pick of starters) {
        const player = bootstrapElements.get(pick.element);
        const live = liveElements.get(pick.element);
        const countedAsPlayed = didStarterConsumeBudget(pick, bootstrapElements, liveElements, teamFixtures);
        const slotWeight = getEffectiveSlotWeight(pick);

        if (player) {
            totalStarterBudget += (player.now_cost / 10) * slotWeight;
        }

        if (countedAsPlayed && player) {
            playedBudget += (player.now_cost / 10) * slotWeight;
            startersPlayed += slotWeight;
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
        startersTotal: starters.reduce((total, pick) => total + getEffectiveSlotWeight(pick), 0),
    };
}
