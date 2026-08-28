const { createApp, ref, shallowRef, computed, watch, nextTick } = Vue;

const calc = shallowRef(null);
const input = ref('');
const entries = ref(JSON.parse(localStorage.getItem('qalc-history') || '[]'));
const stateKey = 'qalc-state';
const RATES_KEY = 'qalc-rates';
const browser = ref(null);
const browserSearch = ref('');
const functions = shallowRef([]);
const variables = shallowRef([]);
const units = shallowRef([]);
const loaded = { functions: false, variables: false, units: false };
const acItems = ref([]);
const acIndex = ref(0);
const hint = ref('');
const acStart = ref(0);
let lastAcKey = '';
const allNames = [];

watch(entries, (v) => {
    localStorage.setItem('qalc-history', JSON.stringify(v));
}, { deep: true });

function debounce(fn, ms) {
    let timer = null;
    function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
}

const saveStateDebounced = debounce(() => {
    if (calc.value) localStorage.setItem(stateKey, calc.value.saveState());
}, 300);

function updatePreview(v) {
    const el = document.getElementById('preview');
    if (!v.trim() || !calc.value) {
        el.textContent = '';
        return;
    }
    const r = JSON.parse(calc.value.calculate(v));
    const out = r.expr_fmt === r.result ? r.result : `${r.expr_fmt} ${r.approx ? '≈' : '='} ${r.result}`;
    const warnings = r.warnings.join(' ');
    el.textContent = warnings ? `${out} ${warnings}` : out;
}

const updatePreviewDebounced = debounce(updatePreview, 150);

watch(input, updatePreviewDebounced);

createApp({
    setup() {
        const reversed = computed(() => entries.value.slice().reverse());

        function submit() {
            const expr = input.value.trim();
            if (!expr) return;
            input.value = '';
            updatePreviewDebounced.cancel();
            updatePreview('');
            const r = JSON.parse(calc.value.calculate(expr));
            entries.value.push(r);
            saveStateDebounced();
        }

        function clearHistory() {
            saveStateDebounced.cancel();
            entries.value = [];
            if (calc.value) calc.value.clearState();
            localStorage.removeItem(stateKey);
        }

        const groupedItems = computed(() => {
            const items = { functions: functions.value, variables: variables.value, units: units.value }[browser.value] || [];
            const q = browserSearch.value.trim().toLowerCase();
            const groups = new Map();
            for (const item of items) {
                if (q && !item.name.toLowerCase().includes(q) && !item.title.toLowerCase().includes(q)) continue;
                if (!groups.has(item.category)) groups.set(item.category, []);
                groups.get(item.category).push(item);
            }
            return [...groups].map(([category, items]) => ({ category, items }));
        });

        async function toggleBrowser(type) {
            if (browser.value === type) {
                closeBrowser();
                return;
            }
            browser.value = type;
            loadDefs();
            await nextTick();
            const el = document.getElementById('browser-search');
            if (el) el.focus();
        }

        function loadDefs() {
            if (!calc.value || loaded.functions) return;
            functions.value = calc.value.getFunctions();
            variables.value = calc.value.getVariables();
            units.value = calc.value.getUnits();
            loaded.functions = loaded.variables = loaded.units = true;
            allNames.length = 0;
            for (const f of functions.value) allNames.push({ name: f.name, title: f.title, type: 'f' });
            for (const v of variables.value) allNames.push({ name: v.name, title: v.title, type: 'v' });
            for (const u of units.value) allNames.push({ name: u.name, title: u.title, type: 'u' });
        }

        function closeBrowser() {
            browser.value = null;
            browserSearch.value = '';
            document.getElementById('input').focus();
        }

        function insertItem(name) {
            const ins = browser.value === 'functions' ? name + '(' : name;
            input.value = (input.value ? input.value + ' ' : '') + ins;
            closeBrowser();
        }

        function updateAc() {
            if (!calc.value) {
                acItems.value = [];
                hint.value = '';
                return;
            }
            if (!loaded.functions) loadDefs();
            const el = document.getElementById('input');
            const caret = el ? el.selectionStart : input.value.length;
            const text = input.value;
            let start = caret;
            while (start > 0 && /[\w.']/.test(text[start - 1])) start--;
            const token = text.slice(start, caret);
            acStart.value = start;

            let matches = [];
            if (token) {
                const q = token.toLowerCase();
                for (const it of allNames) {
                    if (it.name.toLowerCase().startsWith(q)) matches.push(it);
                    if (matches.length >= 8) break;
                }
            }
            const key = start + '|' + matches.map((x) => x.name).join(',');
            if (key !== lastAcKey) acIndex.value = 0;
            lastAcKey = key;
            acItems.value = matches;

            hint.value = '';
            let depth = 0;
            let openIdx = -1;
            for (let j = caret - 1; j >= 0; j--) {
                const ch = text[j];
                if (ch === ')') depth++;
                else if (ch === '(') {
                    if (depth > 0) depth--;
                    else { openIdx = j; break; }
                }
            }
            if (openIdx >= 0) {
                const m = text.slice(0, openIdx).match(/([A-Za-z][A-Za-z0-9_]*)\s*$/);
                if (m) hint.value = calc.value.getFunctionSignature(m[1]);
            }
        }

        function acceptCompletion() {
            const it = acItems.value[acIndex.value];
            if (!it) return;
            const el = document.getElementById('input');
            const caret = el ? el.selectionStart : input.value.length;
            const name = it.type === 'f' ? it.name + '(' : it.name;
            input.value = input.value.slice(0, acStart.value) + name + input.value.slice(caret);
            acItems.value = [];
            hint.value = '';
            const pos = acStart.value + name.length;
            if (el) {
                el.focus();
                el.setSelectionRange(pos, pos);
            }
            updateAc();
        }

        function onKeydown(ev) {
            if (acItems.value.length) {
                if (ev.key === 'ArrowDown') { ev.preventDefault(); acIndex.value = (acIndex.value + 1) % acItems.value.length; return; }
                if (ev.key === 'ArrowUp') { ev.preventDefault(); acIndex.value = (acIndex.value - 1 + acItems.value.length) % acItems.value.length; return; }
                if (ev.key === 'Tab') { ev.preventDefault(); acceptCompletion(); return; }
                if (ev.key === 'Escape') { acItems.value = []; hint.value = ''; return; }
            }
            if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
                ev.preventDefault();
                submit();
            }
        }

        return {
            input, entries: reversed, submit, clearHistory,
            browser, browserSearch, groupedItems,
            toggleBrowser, closeBrowser, insertItem,
            acItems, acIndex, hint,
            updateAc, acceptCompletion, onKeydown,
        };
    },
}).mount('#app');

document.addEventListener('click', (ev) => {
    if (browser.value && !ev.target.closest('#dropdown') && !ev.target.closest('#toolbar')) {
        browser.value = null;
        browserSearch.value = '';
    }
});

const RATE_ENDPOINTS = [
    {
        url: 'https://latest.currency-api.pages.dev/v1/currencies/eur.json',
        transform: (data) => Object.fromEntries(
            Object.entries(data.eur).map(([code, rate]) => [code.toUpperCase(), rate]),
        ),
    },
    {
        url: 'https://www.mycurrency.net/FR.json',
        transform: (data) => {
            const rates = {};
            for (const [code, v] of Object.entries(data.rates || {})) {
                if (v && typeof v === 'object' && typeof v.rate === 'number') rates[code.toUpperCase()] = v.rate;
            }
            return rates;
        },
    },
    {
        url: 'https://www.floatrates.com/daily/eur.json',
        transform: (data) => {
            const rates = {};
            for (const [code, v] of Object.entries(data)) {
                if (v && typeof v === 'object' && typeof v.rate === 'number') rates[code.toUpperCase()] = v.rate;
            }
            return rates;
        },
    },
    /*
    {
        url: 'http://www.floatrates.com/daily/eur.json',
        transform: (data) => {
            const rates = {};
            for (const [code, v] of Object.entries(data)) {
                if (v && typeof v === 'object' && typeof v.rate === 'number') rates[code.toUpperCase()] = v.rate;
            }
            return rates;
        },
    },
    */
];

async function loadExchangeRates() {
    if (!calc.value) return;
    const apply = (rates) => {
        const vec = new Module.VectorCurrencyRate();
        for (const [code, rate] of Object.entries(rates)) {
            if (code.length !== 3 || rate <= 0) continue;
            vec.push_back({ code, rate });
        }
        calc.value.setExchangeRates(vec);
    };
    const cached = JSON.parse(localStorage.getItem(RATES_KEY) || 'null');
    if (cached && Date.now() - cached.ts < 24 * 3600 * 1000) apply(cached.rates);
    else localStorage.removeItem(RATES_KEY);
    for (const endpoint of RATE_ENDPOINTS) {
        try {
            const res = await fetch(endpoint.url);
            const rates = endpoint.transform(await res.json());
            if (!Object.keys(rates).length) continue;
            apply(rates);
            localStorage.setItem(RATES_KEY, JSON.stringify({ ts: Date.now(), url: endpoint.url, rates }));
            return;
        } catch (e) {
            console.error('exchange rates fetch failed:', endpoint.url, e);
        }
    }
}

var Module = {
    postRun: () => {
        calc.value = new Module.Calculator();
        calc.value.loadGlobalDefinitions();
        const saved = localStorage.getItem(stateKey);
        if (saved) calc.value.loadState(saved);
        loadExchangeRates();
        document.getElementById('input').focus();
    },
    print: (text) => console.log(text),
    printErr: (text) => console.error(text),
};
