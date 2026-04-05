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
                { id: 1, web_name: 'Captain', team: 10, now_cost: 100 },
                { id: 2, web_name: 'Starter', team: 20, now_cost: 80 },
                { id: 3, web_name: 'Bench', team: 30, now_cost: 45 },
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
                { id: 1, web_name: 'Captain', team: 10, now_cost: 90 },
                { id: 2, web_name: 'Vice', team: 20, now_cost: 85 },
                { id: 3, web_name: 'Starter', team: 30, now_cost: 70 },
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
                { id: 1, web_name: 'Defender One', team: 10, now_cost: 55 },
                { id: 2, web_name: 'Defender Two', team: 20, now_cost: 50 },
                { id: 3, web_name: 'Midfielder', team: 30, now_cost: 90 },
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
                { id: 1, web_name: 'Captain', team: 10, now_cost: 100 },
                { id: 2, web_name: 'Double', team: 20, now_cost: 80 },
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
                { id: 1, web_name: 'Double', team: 20, now_cost: 80 },
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
                { id: 1, web_name: 'Benched Starter', team: 20, now_cost: 80 },
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
                { id: 1, web_name: 'Captain', team: 10, now_cost: 100 },
                { id: 2, web_name: 'Starter', team: 20, now_cost: 80 },
                { id: 3, web_name: 'Blank', team: 30, now_cost: 75 },
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
});