import { getOrFetchJson } from './cache';
import type {
    BootstrapResponse,
    EntryPicksResponse,
    EventLiveResponse,
    FixtureResponseItem,
    LeagueStandingsResponse,
} from './types';

const API_ROOT = 'https://fantasy.allsvenskan.se/api';

const TTL = {
    bootstrap: 6 * 60 * 60 * 1000,
    standings: 2 * 60 * 1000,
    picks: 10 * 60 * 1000,
    live: 60 * 1000,
    fixtures: 60 * 1000,
};

export function getBootstrap(): Promise<BootstrapResponse> {
    return getOrFetchJson<BootstrapResponse>(
        'bootstrap-static',
        TTL.bootstrap,
        `${API_ROOT}/bootstrap-static/`,
    );
}

export function getLeagueStandings(leagueId: number, phase = 1): Promise<LeagueStandingsResponse> {
    return getOrFetchJson<LeagueStandingsResponse>(
        `league-standings:${leagueId}:${phase}`,
        TTL.standings,
        `${API_ROOT}/leagues-classic/${leagueId}/standings/?page_new_entries=1&page_standings=1&phase=${phase}`,
    );
}

export function getEntryPicks(entryId: number, eventId: number): Promise<EntryPicksResponse> {
    return getOrFetchJson<EntryPicksResponse>(
        `entry-picks:${entryId}:${eventId}`,
        TTL.picks,
        `${API_ROOT}/entry/${entryId}/event/${eventId}/picks/`,
    );
}

export function getEventLive(eventId: number): Promise<EventLiveResponse> {
    return getOrFetchJson<EventLiveResponse>(
        `event-live:${eventId}`,
        TTL.live,
        `${API_ROOT}/event/${eventId}/live/`,
    );
}

export function getFixtures(eventId: number): Promise<FixtureResponseItem[]> {
    return getOrFetchJson<FixtureResponseItem[]>(
        `fixtures:${eventId}`,
        TTL.fixtures,
        `${API_ROOT}/fixtures/?event=${eventId}`,
    );
}
