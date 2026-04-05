export interface EventSummary {
    id: number;
    is_current: boolean;
    finished: boolean;
}

export interface BootstrapElement {
    id: number;
    web_name: string;
    team: number;
    now_cost: number;
}

export interface BootstrapResponse {
    events: EventSummary[];
    elements: BootstrapElement[];
}

export interface LeagueStandingRow {
    rank: number;
    last_rank: number;
    total: number;
    event_total: number;
    entry: number;
    entry_name: string;
    player_name: string;
    has_played: boolean;
}

export interface LeagueStandingsResponse {
    standings: {
        has_next: boolean;
        page: number;
        results: LeagueStandingRow[];
    };
}

export interface EntryPick {
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
}

export interface EntryPicksResponse {
    entry_history: {
        event: number;
        points: number;
        total_points: number;
        value: number;
    };
    picks: EntryPick[];
    automatic_subs: Array<{
        element_in: number;
        element_out: number;
        entry: number;
        event: number;
    }>;
}

export interface LiveElement {
    id: number;
    stats: {
        minutes: number;
        total_points: number;
    };
}

export interface EventLiveResponse {
    elements: LiveElement[];
}

export interface FixtureResponseItem {
    id: number;
    event: number;
    started: boolean;
    finished: boolean;
    team_h: number;
    team_a: number;
}

export interface EnrichedStandingRow {
    rank: number;
    lastRank: number;
    overallPoints: number;
    eventPoints: number;
    entryId: number;
    entryName: string;
    managerName: string;
    playedBudget: number;
    totalStarterBudget: number;
    remainingBudget: number;
    livePoints: number;
    pointsPerMillion: number;
    projectedEventPoints: number;
    projectedSeasonTotal: number;
    startersPlayed: number;
    startersTotal: number;
}

export interface LeagueEnhancementPayload {
    leagueId: number;
    currentEvent: number;
    rows: EnrichedStandingRow[];
    generatedAt: string;
    processedEntries: number;
    totalEntries: number;
    truncated: boolean;
    marketAveragePointsPerMillion: number;
    unsupportedReason?: string;
}

export interface ChromeMessageRequest {
    type: 'GET_LEAGUE_ENHANCEMENT';
    leagueId: number;
}
