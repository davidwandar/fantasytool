import { describe, expect, it } from 'vitest';

import { buildTeamFixtureMap, calculateEnhancedStandingRow } from './calculate';
import type {
    BootstrapElement,
    EntryPick,
    EntryPicksResponse,
    EventLiveResponse,
    FixtureResponseItem,
    LeagueStandingRow,
} from './types';

function createStanding(): LeagueStandingRow {
    return {
        rank: 1,
        last_rank: 1,
        total: 100,
        event_total: 20,
        entry: 123,
        entry_name: 'Test Team',
        player_name: 'Manager',
        has_played: true,
    };
}

function createPicks(picks: EntryPick[], active_chip: string | null = null): EntryPicksResponse {
    return {
        active_chip,
        entry_history: {
            event: 1,
            points: 20,
            total_points: 100,
            value: 1000,
        },
        automatic_subs: [],
        picks,
    };
}

function createBootstrapElements(elements: BootstrapElement[]): Map<number, BootstrapElement> {
    return new Map(elements.map((element) => [element.id, element]));
}

function createLiveElements(elements: EventLiveResponse['elements']): Map<number, EventLiveResponse['elements'][number]> {
    return new Map(elements.map((element) => [element.id, element]));
}

function createFixtures(fixtures: FixtureResponseItem[]): Map<number, FixtureResponseItem[]> {
    return buildTeamFixtureMap(fixtures);
}

describe('calculateEnhancedStandingRow', () => {
    it('counts weighted scoring slots from pick multipliers in a normal captain setup', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false },
                { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
                { element: 3, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'Captain', team: 10, now_cost: 100, element_type: 1 },
                { id: 2, web_name: 'Starter', team: 20, now_cost: 80, element_type: 2 },
                { id: 3, web_name: 'Bench', team: 30, now_cost: 45, element_type: 1 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 6 } },
                { id: 2, stats: { minutes: 90, total_points: 4 } },
                { id: 3, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 10, team_a: 99 },
                { id: 2, event: 1, started: true, finished: true, team_h: 20, team_a: 98 },
                { id: 3, event: 1, started: true, finished: true, team_h: 30, team_a: 97 },
            ]),
        });

        expect(row.startersTotal).toBe(3);
        expect(row.startersPlayed).toBe(3);
        expect(row.livePoints).toBe(16);
        expect(row.playedBudget).toBe(28);
        expect(row.remainingBudget).toBe(0);
    });

    it('counts dynamisk duo from chip multipliers without assuming 12 slots', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 6, multiplier: 3, is_captain: true, is_vice_captain: false },
                { element: 2, position: 10, multiplier: 2, is_captain: false, is_vice_captain: true },
                { element: 3, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false },
            ], '2capt'),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'Captain', team: 10, now_cost: 90, element_type: 3 },
                { id: 2, web_name: 'Vice', team: 20, now_cost: 85, element_type: 4 },
                { id: 3, web_name: 'Starter', team: 30, now_cost: 70, element_type: 4 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 5 } },
                { id: 2, stats: { minutes: 90, total_points: 4 } },
                { id: 3, stats: { minutes: 90, total_points: 2 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 10, team_a: 99 },
                { id: 2, event: 1, started: true, finished: true, team_h: 20, team_a: 98 },
                { id: 3, event: 1, started: true, finished: true, team_h: 30, team_a: 97 },
            ]),
        });

        expect(row.startersTotal).toBe(6);
        expect(row.startersPlayed).toBe(6);
        expect(row.livePoints).toBe(25);
        expect(row.playedBudget).toBe(51);
    });

    it('counts Parkera bussen defender multipliers as extra scoring slots', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 2, multiplier: 2, is_captain: false, is_vice_captain: false },
                { element: 2, position: 3, multiplier: 2, is_captain: false, is_vice_captain: false },
                { element: 3, position: 7, multiplier: 1, is_captain: true, is_vice_captain: false },
            ], 'pdbus'),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'Defender One', team: 10, now_cost: 55, element_type: 2 },
                { id: 2, web_name: 'Defender Two', team: 20, now_cost: 50, element_type: 2 },
                { id: 3, web_name: 'Midfielder', team: 30, now_cost: 90, element_type: 3 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 6 } },
                { id: 2, stats: { minutes: 90, total_points: 5 } },
                { id: 3, stats: { minutes: 90, total_points: 4 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 10, team_a: 99 },
                { id: 2, event: 1, started: true, finished: true, team_h: 20, team_a: 98 },
                { id: 3, event: 1, started: true, finished: true, team_h: 30, team_a: 97 },
            ]),
        });

        expect(row.startersTotal).toBe(5);
        expect(row.startersPlayed).toBe(5);
        expect(row.livePoints).toBe(26);
        expect(row.playedBudget).toBe(30);
        expect(row.pointsPerMillion).toBeCloseTo(26 / 30, 8);
    });

    it('adds extra scoring slots and remaining budget for double gameweeks', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false },
                { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'Captain', team: 10, now_cost: 100, element_type: 1 },
                { id: 2, web_name: 'Double', team: 20, now_cost: 80, element_type: 2 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 6 } },
                { id: 2, stats: { minutes: 90, total_points: 4 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 10, team_a: 99 },
                { id: 2, event: 1, started: true, finished: true, team_h: 20, team_a: 98 },
                { id: 3, event: 1, started: false, finished: false, team_h: 97, team_a: 20 },
            ]),
        });

        expect(row.startersTotal).toBe(4);
        expect(row.startersPlayed).toBe(3);
        expect(row.totalStarterBudget).toBe(36);
        expect(row.playedBudget).toBe(28);
        expect(row.remainingBudget).toBe(8);
    });

    it('counts one completed opportunity for a double-gameweek player with minutes in an in-progress fixture', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'Double', team: 20, now_cost: 80, element_type: 2 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 45, total_points: 3 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: false, team_h: 20, team_a: 98 },
                { id: 2, event: 1, started: false, finished: false, team_h: 97, team_a: 20 },
            ]),
        });

        expect(row.startersTotal).toBe(2);
        expect(row.startersPlayed).toBe(1);
        expect(row.totalStarterBudget).toBe(16);
        expect(row.playedBudget).toBe(8);
        expect(row.remainingBudget).toBe(8);
        expect(row.livePoints).toBe(3);
    });

    it('does not count an in-progress fixture as played when the player has no minutes yet', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'Benched Starter', team: 20, now_cost: 80, element_type: 2 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: false, team_h: 20, team_a: 98 },
            ]),
        });

        expect(row.startersTotal).toBe(1);
        expect(row.startersPlayed).toBe(0);
        expect(row.totalStarterBudget).toBe(8);
        expect(row.playedBudget).toBe(0);
        expect(row.remainingBudget).toBe(8);
        expect(row.pointsPerMillion).toBe(0);
    });

    it('drops blank gameweek players from scoring-slot and budget totals', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false },
                { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
                { element: 3, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'Captain', team: 10, now_cost: 100, element_type: 1 },
                { id: 2, web_name: 'Starter', team: 20, now_cost: 80, element_type: 2 },
                { id: 3, web_name: 'Blank', team: 30, now_cost: 75, element_type: 3 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 6 } },
                { id: 2, stats: { minutes: 90, total_points: 4 } },
                { id: 3, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 10, team_a: 99 },
                { id: 2, event: 1, started: true, finished: true, team_h: 20, team_a: 98 },
            ]),
        });

        expect(row.startersTotal).toBe(3);
        expect(row.startersPlayed).toBe(3);
        expect(row.totalStarterBudget).toBe(28);
        expect(row.playedBudget).toBe(28);
        expect(row.remainingBudget).toBe(0);
    });

    it('auto-subs the first eligible outfield bench player for a finished no-show starter', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 3, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 4, position: 4, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 5, position: 5, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 6, position: 6, multiplier: 1, is_captain: true, is_vice_captain: false, element_type: 3 },
                { element: 7, position: 7, multiplier: 1, is_captain: false, is_vice_captain: true, element_type: 3 },
                { element: 8, position: 8, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 9, position: 9, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 11, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 12, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 13, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 14, position: 14, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 15, position: 15, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 4 },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'GK', team: 1, now_cost: 50, element_type: 1 },
                { id: 2, web_name: 'Def A', team: 2, now_cost: 45, element_type: 2 },
                { id: 3, web_name: 'Def B', team: 3, now_cost: 45, element_type: 2 },
                { id: 4, web_name: 'Def C', team: 4, now_cost: 45, element_type: 2 },
                { id: 5, web_name: 'Mid A', team: 5, now_cost: 70, element_type: 3 },
                { id: 6, web_name: 'Mid B', team: 6, now_cost: 75, element_type: 3 },
                { id: 7, web_name: 'Mid C', team: 7, now_cost: 65, element_type: 3 },
                { id: 8, web_name: 'Mid D', team: 8, now_cost: 60, element_type: 3 },
                { id: 9, web_name: 'Fwd A', team: 9, now_cost: 80, element_type: 4 },
                { id: 10, web_name: 'Fwd B', team: 10, now_cost: 78, element_type: 4 },
                { id: 11, web_name: 'No Show', team: 11, now_cost: 62, element_type: 3 },
                { id: 12, web_name: 'Bench GK', team: 12, now_cost: 40, element_type: 1 },
                { id: 13, web_name: 'Bench Mid', team: 13, now_cost: 55, element_type: 3 },
                { id: 14, web_name: 'Bench Def', team: 14, now_cost: 42, element_type: 2 },
                { id: 15, web_name: 'Bench Fwd', team: 15, now_cost: 50, element_type: 4 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 2 } },
                { id: 2, stats: { minutes: 90, total_points: 6 } },
                { id: 3, stats: { minutes: 90, total_points: 6 } },
                { id: 4, stats: { minutes: 90, total_points: 6 } },
                { id: 5, stats: { minutes: 90, total_points: 5 } },
                { id: 6, stats: { minutes: 90, total_points: 4 } },
                { id: 7, stats: { minutes: 90, total_points: 4 } },
                { id: 8, stats: { minutes: 90, total_points: 4 } },
                { id: 9, stats: { minutes: 90, total_points: 5 } },
                { id: 10, stats: { minutes: 90, total_points: 5 } },
                { id: 11, stats: { minutes: 0, total_points: 0 } },
                { id: 12, stats: { minutes: 0, total_points: 0 } },
                { id: 13, stats: { minutes: 25, total_points: 3 } },
                { id: 14, stats: { minutes: 0, total_points: 0 } },
                { id: 15, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 1, team_a: 101 },
                { id: 2, event: 1, started: true, finished: true, team_h: 2, team_a: 102 },
                { id: 3, event: 1, started: true, finished: true, team_h: 3, team_a: 103 },
                { id: 4, event: 1, started: true, finished: true, team_h: 4, team_a: 104 },
                { id: 5, event: 1, started: true, finished: true, team_h: 5, team_a: 105 },
                { id: 6, event: 1, started: true, finished: true, team_h: 6, team_a: 106 },
                { id: 7, event: 1, started: true, finished: true, team_h: 7, team_a: 107 },
                { id: 8, event: 1, started: true, finished: true, team_h: 8, team_a: 108 },
                { id: 9, event: 1, started: true, finished: true, team_h: 9, team_a: 109 },
                { id: 10, event: 1, started: true, finished: true, team_h: 10, team_a: 110 },
                { id: 11, event: 1, started: true, finished: true, team_h: 11, team_a: 111 },
                { id: 12, event: 1, started: true, finished: true, team_h: 12, team_a: 112 },
                { id: 13, event: 1, started: true, finished: true, team_h: 13, team_a: 113 },
                { id: 14, event: 1, started: true, finished: true, team_h: 14, team_a: 114 },
                { id: 15, event: 1, started: true, finished: true, team_h: 15, team_a: 115 },
            ]),
        });

        expect(row.livePoints).toBe(54);
        expect(row.totalStarterBudget).toBe(74.3);
        expect(row.playedBudget).toBe(74.3);
        expect(row.startersPlayed).toBe(12);
        expect(row.startersTotal).toBe(12);
    });

    it('skips the first bench outfielder when it would break formation', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 3, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 4, position: 4, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 5, position: 5, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 6, position: 6, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 7, position: 7, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 8, position: 8, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 9, position: 9, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 11, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 12, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 13, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 14, position: 14, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 15, position: 15, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 4 },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'GK', team: 1, now_cost: 50, element_type: 1 },
                { id: 2, web_name: 'Def A', team: 2, now_cost: 45, element_type: 2 },
                { id: 3, web_name: 'Def B', team: 3, now_cost: 45, element_type: 2 },
                { id: 4, web_name: 'Def C', team: 4, now_cost: 45, element_type: 2 },
                { id: 5, web_name: 'Mid A', team: 5, now_cost: 65, element_type: 3 },
                { id: 6, web_name: 'Mid B', team: 6, now_cost: 65, element_type: 3 },
                { id: 7, web_name: 'Mid C', team: 7, now_cost: 65, element_type: 3 },
                { id: 8, web_name: 'Mid D', team: 8, now_cost: 65, element_type: 3 },
                { id: 9, web_name: 'Fwd A', team: 9, now_cost: 75, element_type: 4 },
                { id: 10, web_name: 'Fwd B', team: 10, now_cost: 75, element_type: 4 },
                { id: 11, web_name: 'No Show Def', team: 11, now_cost: 45, element_type: 2 },
                { id: 12, web_name: 'Bench GK', team: 12, now_cost: 40, element_type: 1 },
                { id: 13, web_name: 'Bench Mid', team: 13, now_cost: 55, element_type: 3 },
                { id: 14, web_name: 'Bench Def', team: 14, now_cost: 42, element_type: 2 },
                { id: 15, web_name: 'Bench Fwd', team: 15, now_cost: 50, element_type: 4 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 2 } },
                { id: 2, stats: { minutes: 90, total_points: 6 } },
                { id: 3, stats: { minutes: 90, total_points: 6 } },
                { id: 4, stats: { minutes: 90, total_points: 6 } },
                { id: 5, stats: { minutes: 90, total_points: 5 } },
                { id: 6, stats: { minutes: 90, total_points: 5 } },
                { id: 7, stats: { minutes: 90, total_points: 5 } },
                { id: 8, stats: { minutes: 90, total_points: 5 } },
                { id: 9, stats: { minutes: 90, total_points: 4 } },
                { id: 10, stats: { minutes: 90, total_points: 4 } },
                { id: 11, stats: { minutes: 0, total_points: 0 } },
                { id: 12, stats: { minutes: 0, total_points: 0 } },
                { id: 13, stats: { minutes: 20, total_points: 3 } },
                { id: 14, stats: { minutes: 20, total_points: 2 } },
                { id: 15, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 1, team_a: 101 },
                { id: 2, event: 1, started: true, finished: true, team_h: 2, team_a: 102 },
                { id: 3, event: 1, started: true, finished: true, team_h: 3, team_a: 103 },
                { id: 4, event: 1, started: true, finished: true, team_h: 4, team_a: 104 },
                { id: 5, event: 1, started: true, finished: true, team_h: 5, team_a: 105 },
                { id: 6, event: 1, started: true, finished: true, team_h: 6, team_a: 106 },
                { id: 7, event: 1, started: true, finished: true, team_h: 7, team_a: 107 },
                { id: 8, event: 1, started: true, finished: true, team_h: 8, team_a: 108 },
                { id: 9, event: 1, started: true, finished: true, team_h: 9, team_a: 109 },
                { id: 10, event: 1, started: true, finished: true, team_h: 10, team_a: 110 },
                { id: 11, event: 1, started: true, finished: true, team_h: 11, team_a: 111 },
                { id: 12, event: 1, started: true, finished: true, team_h: 12, team_a: 112 },
                { id: 13, event: 1, started: true, finished: true, team_h: 13, team_a: 113 },
                { id: 14, event: 1, started: true, finished: true, team_h: 14, team_a: 114 },
                { id: 15, event: 1, started: true, finished: true, team_h: 15, team_a: 115 },
            ]),
        });

        expect(row.livePoints).toBe(51);
        expect(row.totalStarterBudget).toBe(65);
        expect(row.playedBudget).toBe(65);
        expect(row.startersPlayed).toBe(11);
        expect(row.startersTotal).toBe(11);
    });

    it('auto-subs the bench goalkeeper for a starting goalkeeper no-show', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 3, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 4, position: 4, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 5, position: 5, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 6, position: 6, multiplier: 1, is_captain: true, is_vice_captain: false, element_type: 3 },
                { element: 7, position: 7, multiplier: 1, is_captain: false, is_vice_captain: true, element_type: 3 },
                { element: 8, position: 8, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 9, position: 9, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 11, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 12, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 13, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 14, position: 14, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 15, position: 15, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 4 },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'No Show GK', team: 1, now_cost: 50, element_type: 1 },
                { id: 2, web_name: 'Def A', team: 2, now_cost: 45, element_type: 2 },
                { id: 3, web_name: 'Def B', team: 3, now_cost: 45, element_type: 2 },
                { id: 4, web_name: 'Def C', team: 4, now_cost: 45, element_type: 2 },
                { id: 5, web_name: 'Mid A', team: 5, now_cost: 65, element_type: 3 },
                { id: 6, web_name: 'Mid B', team: 6, now_cost: 70, element_type: 3 },
                { id: 7, web_name: 'Mid C', team: 7, now_cost: 60, element_type: 3 },
                { id: 8, web_name: 'Mid D', team: 8, now_cost: 60, element_type: 3 },
                { id: 9, web_name: 'Fwd A', team: 9, now_cost: 75, element_type: 4 },
                { id: 10, web_name: 'Fwd B', team: 10, now_cost: 75, element_type: 4 },
                { id: 11, web_name: 'Mid E', team: 11, now_cost: 60, element_type: 3 },
                { id: 12, web_name: 'Bench GK', team: 12, now_cost: 42, element_type: 1 },
                { id: 13, web_name: 'Bench Mid', team: 13, now_cost: 55, element_type: 3 },
                { id: 14, web_name: 'Bench Def', team: 14, now_cost: 42, element_type: 2 },
                { id: 15, web_name: 'Bench Fwd', team: 15, now_cost: 50, element_type: 4 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 0, total_points: 0 } },
                { id: 2, stats: { minutes: 90, total_points: 6 } },
                { id: 3, stats: { minutes: 90, total_points: 6 } },
                { id: 4, stats: { minutes: 90, total_points: 6 } },
                { id: 5, stats: { minutes: 90, total_points: 5 } },
                { id: 6, stats: { minutes: 90, total_points: 4 } },
                { id: 7, stats: { minutes: 90, total_points: 4 } },
                { id: 8, stats: { minutes: 90, total_points: 4 } },
                { id: 9, stats: { minutes: 90, total_points: 5 } },
                { id: 10, stats: { minutes: 90, total_points: 5 } },
                { id: 11, stats: { minutes: 90, total_points: 4 } },
                { id: 12, stats: { minutes: 90, total_points: 7 } },
                { id: 13, stats: { minutes: 0, total_points: 0 } },
                { id: 14, stats: { minutes: 0, total_points: 0 } },
                { id: 15, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 1, team_a: 101 },
                { id: 2, event: 1, started: true, finished: true, team_h: 2, team_a: 102 },
                { id: 3, event: 1, started: true, finished: true, team_h: 3, team_a: 103 },
                { id: 4, event: 1, started: true, finished: true, team_h: 4, team_a: 104 },
                { id: 5, event: 1, started: true, finished: true, team_h: 5, team_a: 105 },
                { id: 6, event: 1, started: true, finished: true, team_h: 6, team_a: 106 },
                { id: 7, event: 1, started: true, finished: true, team_h: 7, team_a: 107 },
                { id: 8, event: 1, started: true, finished: true, team_h: 8, team_a: 108 },
                { id: 9, event: 1, started: true, finished: true, team_h: 9, team_a: 109 },
                { id: 10, event: 1, started: true, finished: true, team_h: 10, team_a: 110 },
                { id: 11, event: 1, started: true, finished: true, team_h: 11, team_a: 111 },
                { id: 12, event: 1, started: true, finished: true, team_h: 12, team_a: 112 },
                { id: 13, event: 1, started: true, finished: true, team_h: 13, team_a: 113 },
                { id: 14, event: 1, started: true, finished: true, team_h: 14, team_a: 114 },
                { id: 15, event: 1, started: true, finished: true, team_h: 15, team_a: 115 },
            ]),
        });

        expect(row.livePoints).toBe(60);
        expect(row.totalStarterBudget).toBe(71.2);
        expect(row.playedBudget).toBe(71.2);
        expect(row.pointsPerMillion).toBeCloseTo(60 / 71.2, 8);
    });

    it('moves normal captaincy to the vice-captain when the captain is a finished no-show', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 3, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 4, position: 4, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 5, position: 5, multiplier: 1, is_captain: true, is_vice_captain: false, element_type: 3 },
                { element: 6, position: 6, multiplier: 1, is_captain: false, is_vice_captain: true, element_type: 3 },
                { element: 7, position: 7, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 8, position: 8, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 9, position: 9, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 11, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 12, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 13, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 14, position: 14, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 15, position: 15, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 4 },
            ]),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'GK', team: 1, now_cost: 50, element_type: 1 },
                { id: 2, web_name: 'Def A', team: 2, now_cost: 45, element_type: 2 },
                { id: 3, web_name: 'Def B', team: 3, now_cost: 45, element_type: 2 },
                { id: 4, web_name: 'Def C', team: 4, now_cost: 45, element_type: 2 },
                { id: 5, web_name: 'Captain No Show', team: 5, now_cost: 75, element_type: 3 },
                { id: 6, web_name: 'Vice', team: 6, now_cost: 70, element_type: 3 },
                { id: 7, web_name: 'Mid C', team: 7, now_cost: 65, element_type: 3 },
                { id: 8, web_name: 'Mid D', team: 8, now_cost: 60, element_type: 3 },
                { id: 9, web_name: 'Fwd A', team: 9, now_cost: 75, element_type: 4 },
                { id: 10, web_name: 'Fwd B', team: 10, now_cost: 75, element_type: 4 },
                { id: 11, web_name: 'Mid E', team: 11, now_cost: 60, element_type: 3 },
                { id: 12, web_name: 'Bench GK', team: 12, now_cost: 40, element_type: 1 },
                { id: 13, web_name: 'Bench Mid', team: 13, now_cost: 55, element_type: 3 },
                { id: 14, web_name: 'Bench Def', team: 14, now_cost: 42, element_type: 2 },
                { id: 15, web_name: 'Bench Fwd', team: 15, now_cost: 50, element_type: 4 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 2 } },
                { id: 2, stats: { minutes: 90, total_points: 6 } },
                { id: 3, stats: { minutes: 90, total_points: 6 } },
                { id: 4, stats: { minutes: 90, total_points: 6 } },
                { id: 5, stats: { minutes: 0, total_points: 0 } },
                { id: 6, stats: { minutes: 90, total_points: 4 } },
                { id: 7, stats: { minutes: 90, total_points: 4 } },
                { id: 8, stats: { minutes: 90, total_points: 4 } },
                { id: 9, stats: { minutes: 90, total_points: 5 } },
                { id: 10, stats: { minutes: 90, total_points: 5 } },
                { id: 11, stats: { minutes: 90, total_points: 4 } },
                { id: 12, stats: { minutes: 0, total_points: 0 } },
                { id: 13, stats: { minutes: 25, total_points: 3 } },
                { id: 14, stats: { minutes: 0, total_points: 0 } },
                { id: 15, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 1, team_a: 101 },
                { id: 2, event: 1, started: true, finished: true, team_h: 2, team_a: 102 },
                { id: 3, event: 1, started: true, finished: true, team_h: 3, team_a: 103 },
                { id: 4, event: 1, started: true, finished: true, team_h: 4, team_a: 104 },
                { id: 5, event: 1, started: true, finished: true, team_h: 5, team_a: 105 },
                { id: 6, event: 1, started: true, finished: true, team_h: 6, team_a: 106 },
                { id: 7, event: 1, started: true, finished: true, team_h: 7, team_a: 107 },
                { id: 8, event: 1, started: true, finished: true, team_h: 8, team_a: 108 },
                { id: 9, event: 1, started: true, finished: true, team_h: 9, team_a: 109 },
                { id: 10, event: 1, started: true, finished: true, team_h: 10, team_a: 110 },
                { id: 11, event: 1, started: true, finished: true, team_h: 11, team_a: 111 },
                { id: 12, event: 1, started: true, finished: true, team_h: 12, team_a: 112 },
                { id: 13, event: 1, started: true, finished: true, team_h: 13, team_a: 113 },
                { id: 14, event: 1, started: true, finished: true, team_h: 14, team_a: 114 },
                { id: 15, event: 1, started: true, finished: true, team_h: 15, team_a: 115 },
            ]),
        });

        expect(row.livePoints).toBe(53);
        expect(row.playedBudget).toBe(71.5);
        expect(row.startersTotal).toBe(12);
    });

    it('does not transfer a Parkera bussen multiplier to an auto-subbed replacement', () => {
        const row = calculateEnhancedStandingRow({
            standing: createStanding(),
            picksResponse: createPicks([
                { element: 1, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 2, position: 2, multiplier: 2, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 3, position: 3, multiplier: 2, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 4, position: 4, multiplier: 2, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 5, position: 5, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 6, position: 6, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 7, position: 7, multiplier: 1, is_captain: true, is_vice_captain: false, element_type: 3 },
                { element: 8, position: 8, multiplier: 1, is_captain: false, is_vice_captain: true, element_type: 3 },
                { element: 9, position: 9, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false, element_type: 4 },
                { element: 11, position: 11, multiplier: 2, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 12, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 1 },
                { element: 13, position: 13, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 3 },
                { element: 14, position: 14, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 2 },
                { element: 15, position: 15, multiplier: 0, is_captain: false, is_vice_captain: false, element_type: 4 },
            ], 'pdbus'),
            bootstrapElements: createBootstrapElements([
                { id: 1, web_name: 'GK', team: 1, now_cost: 50, element_type: 1 },
                { id: 2, web_name: 'Def A', team: 2, now_cost: 45, element_type: 2 },
                { id: 3, web_name: 'Def B', team: 3, now_cost: 45, element_type: 2 },
                { id: 4, web_name: 'Def C', team: 4, now_cost: 45, element_type: 2 },
                { id: 5, web_name: 'Mid A', team: 5, now_cost: 65, element_type: 3 },
                { id: 6, web_name: 'Mid B', team: 6, now_cost: 65, element_type: 3 },
                { id: 7, web_name: 'Mid C', team: 7, now_cost: 65, element_type: 3 },
                { id: 8, web_name: 'Mid D', team: 8, now_cost: 65, element_type: 3 },
                { id: 9, web_name: 'Fwd A', team: 9, now_cost: 75, element_type: 4 },
                { id: 10, web_name: 'Fwd B', team: 10, now_cost: 75, element_type: 4 },
                { id: 11, web_name: 'No Show Def', team: 11, now_cost: 45, element_type: 2 },
                { id: 12, web_name: 'Bench GK', team: 12, now_cost: 40, element_type: 1 },
                { id: 13, web_name: 'Bench Mid', team: 13, now_cost: 55, element_type: 3 },
                { id: 14, web_name: 'Bench Def', team: 14, now_cost: 42, element_type: 2 },
                { id: 15, web_name: 'Bench Fwd', team: 15, now_cost: 50, element_type: 4 },
            ]),
            liveElements: createLiveElements([
                { id: 1, stats: { minutes: 90, total_points: 2 } },
                { id: 2, stats: { minutes: 90, total_points: 6 } },
                { id: 3, stats: { minutes: 90, total_points: 6 } },
                { id: 4, stats: { minutes: 90, total_points: 6 } },
                { id: 5, stats: { minutes: 90, total_points: 5 } },
                { id: 6, stats: { minutes: 90, total_points: 5 } },
                { id: 7, stats: { minutes: 90, total_points: 4 } },
                { id: 8, stats: { minutes: 90, total_points: 4 } },
                { id: 9, stats: { minutes: 90, total_points: 4 } },
                { id: 10, stats: { minutes: 90, total_points: 4 } },
                { id: 11, stats: { minutes: 0, total_points: 0 } },
                { id: 12, stats: { minutes: 0, total_points: 0 } },
                { id: 13, stats: { minutes: 25, total_points: 3 } },
                { id: 14, stats: { minutes: 0, total_points: 0 } },
                { id: 15, stats: { minutes: 0, total_points: 0 } },
            ]),
            teamFixtures: createFixtures([
                { id: 1, event: 1, started: true, finished: true, team_h: 1, team_a: 101 },
                { id: 2, event: 1, started: true, finished: true, team_h: 2, team_a: 102 },
                { id: 3, event: 1, started: true, finished: true, team_h: 3, team_a: 103 },
                { id: 4, event: 1, started: true, finished: true, team_h: 4, team_a: 104 },
                { id: 5, event: 1, started: true, finished: true, team_h: 5, team_a: 105 },
                { id: 6, event: 1, started: true, finished: true, team_h: 6, team_a: 106 },
                { id: 7, event: 1, started: true, finished: true, team_h: 7, team_a: 107 },
                { id: 8, event: 1, started: true, finished: true, team_h: 8, team_a: 108 },
                { id: 9, event: 1, started: true, finished: true, team_h: 9, team_a: 109 },
                { id: 10, event: 1, started: true, finished: true, team_h: 10, team_a: 110 },
                { id: 11, event: 1, started: true, finished: true, team_h: 11, team_a: 111 },
                { id: 12, event: 1, started: true, finished: true, team_h: 12, team_a: 112 },
                { id: 13, event: 1, started: true, finished: true, team_h: 13, team_a: 113 },
                { id: 14, event: 1, started: true, finished: true, team_h: 14, team_a: 114 },
                { id: 15, event: 1, started: true, finished: true, team_h: 15, team_a: 115 },
            ]),
        });

        expect(row.livePoints).toBe(67);
        expect(row.totalStarterBudget).toBe(78.5);
        expect(row.playedBudget).toBe(78.5);
        expect(row.startersTotal).toBe(14);
    });
});