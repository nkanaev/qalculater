const { createApp, ref, shallowRef, computed, watch, nextTick } = Vue;

const calc = shallowRef(null);
const input = ref('');
const entries = ref(JSON.parse(localStorage.getItem('qalc-history') || '[]'));
const stateKey = 'qalc-state';
const browser = ref(null);
const browserSearch = ref('');
const functions = shallowRef([]);
const variables = shallowRef([]);
const units = shallowRef([]);
const loaded = { functions: false, variables: false, units: false };

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
            if (!loaded[type] && calc.value) {
                functions.value = calc.value.getFunctions();
                variables.value = calc.value.getVariables();
                units.value = calc.value.getUnits();
                loaded.functions = loaded.variables = loaded.units = true;
            }
            await nextTick();
            const el = document.getElementById('browser-search');
            if (el) el.focus();
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

        return {
            input, entries: reversed, submit, clearHistory,
            browser, browserSearch, groupedItems,
            toggleBrowser, closeBrowser, insertItem,
        };
    },
}).mount('#app');

document.addEventListener('click', (ev) => {
    if (browser.value && !ev.target.closest('#dropdown') && !ev.target.closest('#toolbar')) {
        browser.value = null;
        browserSearch.value = '';
    }
});

var Module = {
    postRun: () => {
        calc.value = new Module.Calculator();
        calc.value.loadGlobalDefinitions();
        const saved = localStorage.getItem(stateKey);
        if (saved) calc.value.loadState(saved);
        document.getElementById('input').focus();
    },
    print: (text) => console.log(text),
    printErr: (text) => console.error(text),
};
