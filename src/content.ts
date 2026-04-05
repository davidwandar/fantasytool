import type { ChromeMessageRequest, LeagueEnhancementPayload } from './types';

const LOG_PREFIX = '[Fantasy Tool]';
type SortMode = 'official' | 'projected';
const NATIVE_CONTROL_ID = 'fantasy-tool-native-controls';
const NATIVE_LOADING_ID = 'fantasy-tool-native-loading';

declare global {
    interface Window {
        __fantasyToolDebug?: {
            lastUrl: string;
            leagueId: number | null;
            status: 'idle' | 'loading' | 'ready' | 'error';
            payload?: LeagueEnhancementPayload;
            error?: string;
        };
    }
}

function updateDebugState(partial: Partial<NonNullable<Window['__fantasyToolDebug']>>): void {
    window.__fantasyToolDebug = {
        lastUrl: window.location.href,
        leagueId: null,
        status: 'idle',
        ...(window.__fantasyToolDebug ?? {}),
        ...partial,
    };
}

function log(message: string, ...details: unknown[]): void {
    console.log(LOG_PREFIX, message, ...details);
}

function compareByProjected(left: LeagueEnhancementPayload['rows'][number], right: LeagueEnhancementPayload['rows'][number]): number {
    if (right.projectedSeasonTotal !== left.projectedSeasonTotal) {
        return right.projectedSeasonTotal - left.projectedSeasonTotal;
    }

    if (right.projectedEventPoints !== left.projectedEventPoints) {
        return right.projectedEventPoints - left.projectedEventPoints;
    }

    return left.rank - right.rank;
}

function compareByOfficial(left: LeagueEnhancementPayload['rows'][number], right: LeagueEnhancementPayload['rows'][number]): number {
    if (left.rank !== right.rank) {
        return left.rank - right.rank;
    }

    return compareByProjected(left, right);
}

function getSortedRows(payload: LeagueEnhancementPayload, sortMode: SortMode): LeagueEnhancementPayload['rows'] {
    const rows = [...payload.rows];
    if (sortMode === 'official') {
        rows.sort(compareByOfficial);
        return rows;
    }

    rows.sort(compareByProjected);
    return rows;
}

function getProjectedRankByEntryId(payload: LeagueEnhancementPayload): Map<number, number> {
    const projectedRows = getSortedRows(payload, 'projected');
    return new Map(projectedRows.map((row, index) => [row.entryId, index + 1]));
}

function getNativeTableHeaders(table: HTMLTableElement): string[] {
    return Array.from(table.querySelectorAll('thead th')).map((header) => header.textContent?.trim() ?? '');
}

function findNativeLeagueTable(): HTMLTableElement | null {
    const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table'));

    for (const table of tables) {
        const headers = getNativeTableHeaders(table);
        const normalizedHeaders = headers.map((header) => header.toLowerCase());
        const looksLikeLeagueTable =
            normalizedHeaders.includes('ranking') &&
            normalizedHeaders.some((header) => header.includes('lag') || header.includes('tränare')) &&
            normalizedHeaders.includes('tot');

        if (looksLikeLeagueTable) {
            return table;
        }
    }

    return null;
}

function getEntryIdFromRow(row: HTMLTableRowElement): number | null {
    const link = row.querySelector<HTMLAnchorElement>('a[href*="/entry/"]');
    if (!link) {
        return null;
    }

    const match = link.getAttribute('href')?.match(/\/entry\/(\d+)\//);
    return match ? Number(match[1]) : null;
}

function getRankMaps(payload: LeagueEnhancementPayload): {
    projectedRankByEntryId: Map<number, number>;
} {
    const projectedRankByEntryId = getProjectedRankByEntryId(payload);

    return { projectedRankByEntryId };
}

function formatLeftToPlay(row: LeagueEnhancementPayload['rows'][number]): string {
    const leftSlots = Math.max(0, row.startersTotal - row.startersPlayed);
    return `${leftSlots}/${row.startersTotal} - ${formatNumber(row.remainingBudget, 1)}m`;
}

function ensureNativeHeaderCells(table: HTMLTableElement): void {
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) {
        return;
    }

    headerRow.querySelector('th[data-fantasy-tool-header="Budget"]')?.remove();
    headerRow.querySelector('th[data-fantasy-tool-header="Played"]')?.remove();
    headerRow.querySelector('th[data-fantasy-tool-header="Delta"]')?.remove();

    const existingHeaders = Array.from(headerRow.querySelectorAll('th')).map((cell) => cell.getAttribute('data-fantasy-tool-header') ?? cell.textContent?.trim() ?? '');
    const desiredHeaders = ['Pts/M', 'Left to play', 'xP'];

    for (const desiredHeader of desiredHeaders) {
        if (existingHeaders.includes(desiredHeader)) {
            continue;
        }

        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.dataset.fantasyToolHeader = desiredHeader;
        cell.style.background = 'rgba(15, 122, 47, 0.08)';
        cell.style.whiteSpace = 'nowrap';
        cell.textContent = desiredHeader;
        headerRow.appendChild(cell);
    }

    for (const desiredHeader of desiredHeaders) {
        const cell = headerRow.querySelector<HTMLTableCellElement>(`th[data-fantasy-tool-header="${desiredHeader}"]`);
        if (cell) {
            headerRow.appendChild(cell);
        }
    }
}

function upsertNativeCell(row: HTMLTableRowElement, key: string, text: string, style?: Partial<CSSStyleDeclaration>): void {
    let cell = row.querySelector<HTMLTableCellElement>(`td[data-fantasy-tool-cell="${key}"]`);
    if (!cell) {
        cell = document.createElement('td');
        cell.dataset.fantasyToolCell = key;
        row.appendChild(cell);
    }

    cell.textContent = text;
    cell.style.background = 'rgba(15, 122, 47, 0.05)';
    cell.style.whiteSpace = 'nowrap';

    if (style) {
        Object.assign(cell.style, style);
    }
}

function augmentNativeTable(table: HTMLTableElement, payload: LeagueEnhancementPayload): boolean {
    if (payload.unsupportedReason) {
        return false;
    }

    const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    if (bodyRows.length === 0) {
        return false;
    }

    const rowByEntryId = new Map(payload.rows.map((row) => [row.entryId, row]));
    const { projectedRankByEntryId } = getRankMaps(payload);

    ensureNativeHeaderCells(table);

    let matchedRows = 0;

    for (const bodyRow of bodyRows) {
        const entryId = getEntryIdFromRow(bodyRow);
        if (!entryId) {
            continue;
        }

        const row = rowByEntryId.get(entryId);
        if (!row) {
            continue;
        }

        matchedRows += 1;
        upsertNativeCell(bodyRow, 'ppm', formatNumber(row.pointsPerMillion, 2), { textAlign: 'right', fontWeight: '700' });
        upsertNativeCell(bodyRow, 'left-to-play', formatLeftToPlay(row), { textAlign: 'right' });
        upsertNativeCell(bodyRow, 'xp', formatNumber(row.projectedEventPoints, 1), { textAlign: 'right', fontWeight: '700' });

        bodyRow.querySelector('td[data-fantasy-tool-cell="budget"]')?.remove();
        bodyRow.querySelector('td[data-fantasy-tool-cell="played"]')?.remove();
        bodyRow.querySelector('td[data-fantasy-tool-cell="delta"]')?.remove();

        const cellOrder = ['ppm', 'left-to-play', 'xp'];
        for (const cellKey of cellOrder) {
            const cell = bodyRow.querySelector<HTMLTableCellElement>(`td[data-fantasy-tool-cell="${cellKey}"]`);
            if (cell) {
                bodyRow.appendChild(cell);
            }
        }

        bodyRow.dataset.fantasyToolEntryId = String(entryId);
        bodyRow.dataset.fantasyToolOfficialRank = String(row.rank);
        bodyRow.dataset.fantasyToolProjectedRank = String(projectedRankByEntryId.get(entryId) ?? row.rank);
    }

    return matchedRows > 0;
}

function getNativeContainer(table: HTMLTableElement): HTMLElement {
    return table.parentElement?.parentElement?.parentElement ?? table.parentElement ?? table;
}

function clearNativeLoading(): void {
    document.getElementById(NATIVE_LOADING_ID)?.remove();
}

function renderNativeLoading(table: HTMLTableElement, message = 'Fetching Fantasy Tool data...'): void {
    const container = getNativeContainer(table);
    clearNativeLoading();

    const loading = document.createElement('div');
    loading.id = NATIVE_LOADING_ID;
    loading.style.display = 'flex';
    loading.style.alignItems = 'center';
    loading.style.gap = '10px';
    loading.style.margin = '0 0 12px';
    loading.style.padding = '10px 12px';
    loading.style.borderRadius = '10px';
    loading.style.background = 'rgba(15, 122, 47, 0.06)';
    loading.style.fontSize = '12px';
    loading.style.opacity = '0.9';
    loading.innerHTML = `
    <span style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(15,122,47,0.22);border-top-color:#0f7a2f;display:inline-block;animation: fantasy-tool-spin 0.9s linear infinite;"></span>
    <span><strong>Fantasy Tool</strong>: ${message}</span>
  `;

    if (!document.getElementById('fantasy-tool-spin-style')) {
        const style = document.createElement('style');
        style.id = 'fantasy-tool-spin-style';
        style.textContent = '@keyframes fantasy-tool-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }

    container.insertBefore(loading, container.firstChild);
}

function applyNativeTableSort(table: HTMLTableElement, sortMode: SortMode): void {
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        return;
    }

    const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr'));
    rows.sort((left, right) => {
        const rankKey = sortMode === 'projected' ? 'fantasyToolProjectedRank' : 'fantasyToolOfficialRank';
        const leftValue = Number(left.dataset[rankKey] ?? Number.MAX_SAFE_INTEGER);
        const rightValue = Number(right.dataset[rankKey] ?? Number.MAX_SAFE_INTEGER);

        if (leftValue !== rightValue) {
            return leftValue - rightValue;
        }

        const leftOfficial = Number(left.dataset.fantasyToolOfficialRank ?? Number.MAX_SAFE_INTEGER);
        const rightOfficial = Number(right.dataset.fantasyToolOfficialRank ?? Number.MAX_SAFE_INTEGER);
        return leftOfficial - rightOfficial;
    });

    for (const row of rows) {
        tbody.appendChild(row);
    }
}

function renderNativeControls(table: HTMLTableElement, sortMode: SortMode, payload?: LeagueEnhancementPayload): void {
    const container = getNativeContainer(table);
    const existing = document.getElementById(NATIVE_CONTROL_ID);
    if (existing) {
        existing.remove();
    }

    clearNativeLoading();

    const controls = document.createElement('div');
    controls.id = NATIVE_CONTROL_ID;
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.alignItems = 'center';
    controls.style.gap = '12px';
    controls.style.flexWrap = 'wrap';
    controls.style.margin = '0 0 12px';
    controls.style.padding = '10px 12px';
    controls.style.borderRadius = '10px';
    controls.style.background = 'rgba(15, 122, 47, 0.06)';

    const limitText = payload?.truncated
        ? ` Showing first ${payload.processedEntries} of ${payload.totalEntries} entries to limit API load.`
        : payload?.unsupportedReason
            ? ` ${payload.unsupportedReason}`
            : payload
                ? ` Processed ${payload.processedEntries} entries. xP is current live points plus an estimate for the starter budget still left to play, using the league's live average of ${formatNumber(payload.marketAveragePointsPerMillion, 2)} points per million.`
                : '';

    const infoText = limitText.trim();
    const infoMarkup = infoText ? `<div style="font-size:12px;opacity:0.82;">${infoText}</div>` : '';
    const sortControlsMarkup = payload?.unsupportedReason
        ? ''
        : `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <span style="font-size:12px;opacity:0.72;">Sort:</span>
      <button type="button" data-native-sort="official" style="border:1px solid ${sortMode === 'official' ? '#111' : 'rgba(0,0,0,0.2)'};background:${sortMode === 'official' ? '#111' : '#fff'};color:${sortMode === 'official' ? '#fff' : '#111'};border-radius:999px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;font-weight:${sortMode === 'official' ? '700' : '500'};">Official Rank</button>
      <button type="button" data-native-sort="projected" style="border:1px solid ${sortMode === 'projected' ? '#0f7a2f' : 'rgba(15,122,47,0.35)'};background:${sortMode === 'projected' ? '#0f7a2f' : '#fff'};color:${sortMode === 'projected' ? '#fff' : '#0f7a2f'};border-radius:999px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;font-weight:${sortMode === 'projected' ? '700' : '600'};">Projected Rank</button>
    </div>`;

    controls.innerHTML = `
    ${infoMarkup}
    ${sortControlsMarkup}
  `;

    controls.querySelectorAll<HTMLButtonElement>('[data-native-sort]').forEach((button) => {
        button.addEventListener('click', () => {
            const nextSortMode = button.dataset.nativeSort === 'projected'
                ? 'projected'
                : 'official';
            log('Switching native table sort mode.', { nextSortMode });
            applyNativeTableSort(table, nextSortMode);
            renderNativeControls(table, nextSortMode, payload);
        });
    });

    container.insertBefore(controls, container.firstChild);
}

function parseLeagueIdFromUrl(url: URL): number | null {
    const patterns = [
        /\/leagues(?:-classic)?\/(\d+)/,
        /\/league\/(\d+)/,
        /\/api\/leagues-classic\/(\d+)\//,
    ];

    for (const pattern of patterns) {
        const match = url.pathname.match(pattern);
        if (match) {
            return Number(match[1]);
        }
    }

    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    for (const anchor of anchors) {
        for (const pattern of patterns) {
            const match = anchor.href.match(pattern);
            if (match) {
                return Number(match[1]);
            }
        }
    }

    const html = document.documentElement.innerHTML;
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            return Number(match[1]);
        }
    }

    return null;
}

function formatNumber(value: number, digits = 2): string {
    return new Intl.NumberFormat('sv-SE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

async function requestEnhancement(leagueId: number): Promise<LeagueEnhancementPayload> {
    const request: ChromeMessageRequest = {
        type: 'GET_LEAGUE_ENHANCEMENT',
        leagueId,
    };

    const response = await chrome.runtime.sendMessage(request) as
        | { ok: true; payload: LeagueEnhancementPayload }
        | { ok: false; error: string };

    if (!response.ok) {
        throw new Error(response.error);
    }

    return response.payload;
}

let lastUrl = '';
let inFlight = false;

async function hydrate(): Promise<void> {
    const url = new URL(window.location.href);
    const leagueId = parseLeagueIdFromUrl(url);

    log('Hydrate triggered', { url: url.href, leagueId });
    updateDebugState({ lastUrl: url.href, leagueId });

    if (!leagueId) {
        log('No league ID detected on this page yet.');
        return;
    }

    if (inFlight) {
        log('Request already in flight, skipping duplicate hydrate.');
        return;
    }

    inFlight = true;

    try {
        updateDebugState({ leagueId, status: 'loading', error: undefined });
        const nativeTable = findNativeLeagueTable();
        if (nativeTable) {
            renderNativeLoading(nativeTable);
        }
        log('Requesting enhanced standings payload from background worker.', { leagueId });
        const payload = await requestEnhancement(leagueId);
        log('Received enhanced standings payload.', payload);
        updateDebugState({
            leagueId: payload.leagueId,
            status: 'ready',
            payload,
            error: undefined,
        });

        const nativeTableAfterFetch = findNativeLeagueTable();
        if (nativeTableAfterFetch) {
            if (payload.unsupportedReason) {
                log('League is unsupported for v1 native augmentation.', { reason: payload.unsupportedReason });
                renderNativeControls(nativeTableAfterFetch, 'official', payload);
                return;
            }

            const nativeTableAugmented = augmentNativeTable(nativeTableAfterFetch, payload);
            log('Native table detection result.', { found: true, nativeTableAugmented });

            if (nativeTableAugmented) {
                applyNativeTableSort(nativeTableAfterFetch, 'official');
                renderNativeControls(nativeTableAfterFetch, 'official', payload);
            }
        } else {
            log('No native league table found for augmentation.');
        }
    } catch (error) {
        clearNativeLoading();
        const message = error instanceof Error ? error.message : 'Unknown error';
        updateDebugState({ status: 'error', error: message });
        log('Failed to build enhanced standings.', message);
    } finally {
        inFlight = false;
    }
}

function scheduleHydrate(): void {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl && document.getElementById(NATIVE_CONTROL_ID)) {
        return;
    }

    lastUrl = currentUrl;
    void hydrate();
}

const observer = new MutationObserver(() => {
    scheduleHydrate();
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
});

window.addEventListener('popstate', scheduleHydrate);
window.addEventListener('load', scheduleHydrate);
log('Content script loaded.', { url: window.location.href });
updateDebugState({ lastUrl: window.location.href, leagueId: null, status: 'idle' });
scheduleHydrate();