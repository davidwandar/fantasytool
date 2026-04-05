import { getBootstrap, getEntryPicks, getEventLive, getFixtures, getLeagueStandings } from './api';
import { buildTeamFixtureMap, calculateEnhancedStandingRow } from './calculate';
import type {
    BootstrapElement,
    ChromeMessageRequest,
    EnrichedStandingRow,
    LeagueEnhancementPayload,
} from './types';

const LOG_PREFIX = '[Fantasy Tool]';
const MAX_LEAGUE_ENTRIES = 50;

function log(message: string, ...details: unknown[]): void {
    console.log(LOG_PREFIX, message, ...details);
}

async function runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await task(items[currentIndex], currentIndex);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
    return results;
}

async function buildLeagueEnhancement(leagueId: number): Promise<LeagueEnhancementPayload> {
    log('Building league enhancement payload.', { leagueId });
    const bootstrap = await getBootstrap();
    const currentEvent = bootstrap.events.find((event) => event.is_current)?.id;

    if (!currentEvent) {
        throw new Error('Could not determine the current event from bootstrap-static.');
    }

    const [standingsResponse, liveResponse, fixturesResponse] = await Promise.all([
        getLeagueStandings(leagueId),
        getEventLive(currentEvent),
        getFixtures(currentEvent),
    ]);

    log('Fetched base API payloads.', {
        leagueId,
        currentEvent,
        standings: standingsResponse.standings.results.length,
        hasNext: standingsResponse.standings.has_next,
        liveElements: liveResponse.elements.length,
        fixtures: fixturesResponse.length,
    });

    const bootstrapElements = new Map<number, BootstrapElement>(
        bootstrap.elements.map((element) => [element.id, element]),
    );
    const liveElements = new Map(liveResponse.elements.map((element) => [element.id, element]));
    const teamFixtures = buildTeamFixtureMap(fixturesResponse);
    const allStandingsRows = standingsResponse.standings.results;
    const pagedLeague = standingsResponse.standings.has_next;

    if (pagedLeague) {
        log('League enhancement disabled because league spans multiple standings pages.', {
            leagueId,
            page: standingsResponse.standings.page,
            processedEntries: 0,
            visibleEntries: allStandingsRows.length,
        });

        return {
            leagueId,
            currentEvent,
            rows: [],
            generatedAt: new Date().toISOString(),
            processedEntries: 0,
            totalEntries: allStandingsRows.length,
            truncated: false,
            marketAveragePointsPerMillion: 0,
            unsupportedReason: 'Fantasy Tool v1 only supports mini leagues that fit on a single standings page (50 teams max).',
        };
    }

    const limitedStandingsRows = allStandingsRows.slice(0, MAX_LEAGUE_ENTRIES);
    const truncated = allStandingsRows.length > MAX_LEAGUE_ENTRIES;

    if (truncated) {
        log('League enhancement truncated to capped entry count.', {
            leagueId,
            totalEntries: allStandingsRows.length,
            processedEntries: limitedStandingsRows.length,
            maxEntries: MAX_LEAGUE_ENTRIES,
        });
    }

    const rows = await runWithConcurrency(
        limitedStandingsRows,
        4,
        async (standing): Promise<EnrichedStandingRow> => {
            const picksResponse = await getEntryPicks(standing.entry, currentEvent);
            return calculateEnhancedStandingRow({
                standing,
                picksResponse,
                bootstrapElements,
                liveElements,
                teamFixtures,
            });
        },
    );

    log('Calculated enhanced rows.', {
        leagueId,
        rows: rows.length,
        sample: rows.slice(0, 3),
    });

    const aggregatePlayedBudget = rows.reduce((total, row) => total + row.playedBudget, 0);
    const aggregateLivePoints = rows.reduce((total, row) => total + row.livePoints, 0);
    const marketAveragePointsPerMillion = aggregatePlayedBudget > 0 ? aggregateLivePoints / aggregatePlayedBudget : 0;

    const projectedRows = rows.map((row) => {
        const projectedEventPoints = row.livePoints + (row.remainingBudget * marketAveragePointsPerMillion);
        const projectedSeasonTotal = (row.overallPoints - row.eventPoints) + projectedEventPoints;

        return {
            ...row,
            projectedEventPoints,
            projectedSeasonTotal,
        };
    });

    projectedRows.sort((left, right) => {
        if (right.projectedSeasonTotal !== left.projectedSeasonTotal) {
            return right.projectedSeasonTotal - left.projectedSeasonTotal;
        }

        if (right.projectedEventPoints !== left.projectedEventPoints) {
            return right.projectedEventPoints - left.projectedEventPoints;
        }

        return left.rank - right.rank;
    });

    log('Calculated projection baseline.', {
        leagueId,
        marketAveragePointsPerMillion,
        sample: projectedRows.slice(0, 3).map((row) => ({
            entryId: row.entryId,
            projectedEventPoints: row.projectedEventPoints,
            projectedSeasonTotal: row.projectedSeasonTotal,
        })),
    });

    return {
        leagueId,
        currentEvent,
        rows: projectedRows,
        generatedAt: new Date().toISOString(),
        processedEntries: limitedStandingsRows.length,
        totalEntries: allStandingsRows.length,
        truncated,
        marketAveragePointsPerMillion,
    };
}

chrome.runtime.onMessage.addListener((message: ChromeMessageRequest, _sender, sendResponse) => {
    if (message.type !== 'GET_LEAGUE_ENHANCEMENT') {
        return false;
    }

    log('Received runtime message.', message);

    buildLeagueEnhancement(message.leagueId)
        .then((payload) => {
            log('Sending successful enhancement payload.', {
                leagueId: message.leagueId,
                rows: payload.rows.length,
            });
            sendResponse({ ok: true, payload });
        })
        .catch((error: unknown) => {
            const detail = error instanceof Error ? error.message : 'Unknown error';
            log('Failed to build enhancement payload.', detail);
            sendResponse({ ok: false, error: detail });
        });

    return true;
});
