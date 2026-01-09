var HARDCORE_TOP_DAMAGE = (function () {
    var DEFAULT_LEVEL = 100;
    var DEFAULT_GEN = 9;
    var MAX_RESULTS = 30;
    var MAX_EVS_TOTAL = 510;
    var MAX_EVS_STAT = 252;
    var statAliases = {
        hp: 'hp',
        at: 'atk',
        df: 'def',
        sa: 'spa',
        sd: 'spd',
        sp: 'spe',
        spc: 'spa',
    };
    var statOrder = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    var SETDEX = [
        {},
        typeof SETDEX_RBY === 'undefined' ? {} : SETDEX_RBY,
        typeof SETDEX_GSC === 'undefined' ? {} : SETDEX_GSC,
        typeof SETDEX_ADV === 'undefined' ? {} : SETDEX_ADV,
        typeof SETDEX_DPP === 'undefined' ? {} : SETDEX_DPP,
        typeof SETDEX_BW === 'undefined' ? {} : SETDEX_BW,
        typeof SETDEX_XY === 'undefined' ? {} : SETDEX_XY,
        typeof SETDEX_SM === 'undefined' ? {} : SETDEX_SM,
        typeof SETDEX_SS === 'undefined' ? {} : SETDEX_SS,
        typeof SETDEX_SV === 'undefined' ? {} : SETDEX_SV,
    ];

    function mapStats(stats, defaultValue) {
        var mapped = {
            hp: defaultValue,
            atk: defaultValue,
            def: defaultValue,
            spa: defaultValue,
            spd: defaultValue,
            spe: defaultValue,
        };
        if (!stats) return mapped;
        Object.keys(stats).forEach(function (key) {
            var mappedKey = statAliases[key];
            if (!mappedKey) return;
            if (key === 'spc') {
                mapped.spa = stats[key];
                mapped.spd = stats[key];
                return;
            }
            mapped[mappedKey] = stats[key];
        });
        return mapped;
    }

    function clampStatRange(stats, minValue, maxValue) {
        statOrder.forEach(function (stat) {
            stats[stat] = Math.max(minValue, Math.min(maxValue, stats[stat] || 0));
        });
        return stats;
    }

    function clampEvs(stats) {
        var total = 0;
        statOrder.forEach(function (stat) {
            stats[stat] = Math.max(0, Math.min(MAX_EVS_STAT, stats[stat] || 0));
            total += stats[stat];
        });
        if (total <= MAX_EVS_TOTAL) return stats;
        var excess = total - MAX_EVS_TOTAL;
        statOrder.forEach(function (stat) {
            if (excess <= 0) return;
            var reduction = Math.min(stats[stat], excess);
            stats[stat] -= reduction;
            excess -= reduction;
        });
        return stats;
    }

    function normalizeIVs(ivs) {
        if (!ivs) return undefined;
        var mapped = mapStats(ivs, 31);
        return clampStatRange(mapped, 0, 31);
    }

    function normalizeEVs(evs, generation) {
        if (!evs) {
            return generation.num >= 3 ? mapStats(undefined, 0) : undefined;
        }
        var mapped = mapStats(evs, 0);
        if (generation.num >= 3) {
            return clampEvs(mapped);
        }
        return mapped;
    }

    function normalizeItem(item) {
        if (!item) return '';
        return item === 'Eviolite' || item.indexOf('ite') === -1 ? item : '';
    }

    function buildPokemon(generation, name, set) {
        var species = generation.species.get(calc.toID(name));
        if (!species) return null;
        return new calc.Pokemon(generation, name, {
            level: DEFAULT_LEVEL,
            ability: set.ability,
            abilityOn: true,
            item: normalizeItem(set.item),
            nature: set.nature || 'Serious',
            ivs: normalizeIVs(set.ivs),
            evs: normalizeEVs(set.evs, generation),
        });
    }

    function populateDefenderOptions(defenderSelect, setdex, generation) {
        defenderSelect.innerHTML = '';
        var pokemonNames = Object.keys(setdex).sort();
        var defaultValue = 'Clodsire||Leader Misty';
        pokemonNames.forEach(function (pokemon) {
            if (!generation.species.get(calc.toID(pokemon))) return;
            var setNames = Object.keys(setdex[pokemon]).sort();
            var optGroup = document.createElement('optgroup');
            optGroup.label = pokemon;
            setNames.forEach(function (setName) {
                var option = document.createElement('option');
                option.value = pokemon + '||' + setName;
                option.textContent = pokemon + ' (' + setName + ')';
                optGroup.appendChild(option);
            });
            defenderSelect.appendChild(optGroup);
        });
        if (defenderSelect.querySelector('option[value="' + defaultValue + '"]')) {
            defenderSelect.value = defaultValue;
        } else {
            var firstOption = defenderSelect.querySelector('option');
            if (firstOption) {
                defenderSelect.value = firstOption.value;
            }
        }
    }

    function parseDefenderSelection(value) {
        var parts = value.split('||');
        return {
            pokemon: parts[0],
            setName: parts[1],
        };
    }

    function formatDisplayValue(value) {
        return value && value.length ? value : '—';
    }

    function getInitialGeneration() {
        var params = new URLSearchParams(window.location.search);
        var genParam = parseInt(params.get('gen'), 10);
        if (Number.isFinite(genParam) && genParam >= 1 && genParam <= 9) return genParam;
        return DEFAULT_GEN;
    }

    function getSetdexPreference() {
        var params = new URLSearchParams(window.location.search);
        return params.get('setdex') === 'standard' ? 'standard' : 'hardcore';
    }

    function updateUrlGeneration(gen) {
        var params = new URLSearchParams(window.location.search);
        if (gen === DEFAULT_GEN) {
            params.delete('gen');
        } else {
            params.set('gen', gen);
        }
        var query = params.toString();
        var newUrl = window.location.pathname + (query.length ? '?' + query : '');
        if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    function resolveSetdex(gen) {
        var setdex = SETDEX[gen] || {};
        var label = 'Standard';
        if (gen === 9 && typeof SETDEX_HARDCORE !== 'undefined' && getSetdexPreference() === 'hardcore') {
            setdex = SETDEX_HARDCORE;
            label = 'Hardcore';
        }
        return {
            setdex: setdex,
            label: label,
        };
    }

    function calculateTopDamage(defender, setdex, generation) {
        var field = new calc.Field();
        var results = [];
        Object.keys(setdex).forEach(function (pokemon) {
            Object.keys(setdex[pokemon]).forEach(function (setName) {
                var set = setdex[pokemon][setName];
                if (!set.moves || !set.moves.length) return;
                var attacker = buildPokemon(generation, pokemon, set);
                if (!attacker) return;
                var item = normalizeItem(set.item);
                var bestMove = null;
                set.moves.forEach(function (moveName) {
                    if (!moveName) return;
                    var move = new calc.Move(generation, moveName, {
                        ability: set.ability,
                        item: item,
                        species: attacker.name,
                    });
                    var result = calc.calculate(generation, attacker, defender, move, field);
                    // calc.calculate already accounts for multi-hit totals in result.range().
                    var maxDamage = result.range()[1];
                    if (!bestMove || maxDamage > bestMove.maxDamage) {
                        bestMove = {
                            move: moveName,
                            maxDamage: maxDamage,
                        };
                    }
                });
                if (!bestMove) return;
                results.push({
                    pokemon: pokemon,
                    setName: setName,
                    ability: set.ability,
                    item: item,
                    move: bestMove.move,
                    maxDamage: bestMove.maxDamage,
                    maxPercent: (bestMove.maxDamage / defender.maxHP()) * 100,
                });
            });
        });
        return results.sort(function (a, b) {
            return b.maxDamage - a.maxDamage;
        }).slice(0, MAX_RESULTS);
    }

    function renderResults(table, tableBody, status, results) {
        tableBody.innerHTML = '';
        var tableHead = table.querySelector('thead');
        if (tableHead) {
            tableHead.style.display = results.length ? '' : 'none';
        }
        results.forEach(function (result) {
            var row = document.createElement('tr');
            var pokemonCell = document.createElement('td');
            pokemonCell.innerHTML = '<div>' + result.pokemon + '</div><div class="small-text">' + result.setName + '</div>';
            row.appendChild(pokemonCell);

            var abilityCell = document.createElement('td');
            abilityCell.textContent = formatDisplayValue(result.ability);
            row.appendChild(abilityCell);

            var itemCell = document.createElement('td');
            itemCell.textContent = formatDisplayValue(result.item);
            row.appendChild(itemCell);

            var moveCell = document.createElement('td');
            moveCell.textContent = result.move;
            row.appendChild(moveCell);

            var damageCell = document.createElement('td');
            damageCell.textContent = result.maxPercent.toFixed(1) + '%';
            row.appendChild(damageCell);

            tableBody.appendChild(row);
        });
        status.textContent = results.length
            ? 'Showing top ' + results.length + ' attackers.'
            : 'No results found for the selected defender.';
    }

    function init() {
        var defenderSelect = document.getElementById('defender-select');
        var generationSelect = document.getElementById('generation-select');
        var calculateButton = document.getElementById('calculate-button');
        var resultsTable = document.getElementById('results-table');
        var resultsTableBody = document.querySelector('#results-table tbody');
        var resultsStatus = document.getElementById('results-status');
        var setdexNote = document.getElementById('setdex-note');
        if (!defenderSelect || !calculateButton || !resultsTable || !resultsTableBody || !resultsStatus || !generationSelect || !setdexNote) return;

        var currentGen = getInitialGeneration();
        generationSelect.value = String(currentGen);

        var currentSetdexInfo = resolveSetdex(currentGen);
        var currentSetdex = currentSetdexInfo.setdex;
        var currentGeneration = calc.Generations.get(currentGen);
        populateDefenderOptions(defenderSelect, currentSetdex, currentGeneration);
        setdexNote.textContent = 'Using Gen ' + currentGen + ' ' + currentSetdexInfo.label + ' setdex.';
        var tableHead = resultsTable.querySelector('thead');
        if (tableHead) {
            tableHead.style.display = 'none';
        }

        generationSelect.addEventListener('change', function () {
            var nextGen = parseInt(generationSelect.value, 10);
            if (!Number.isFinite(nextGen)) return;
            currentGen = nextGen;
            updateUrlGeneration(currentGen);
            currentSetdexInfo = resolveSetdex(currentGen);
            currentSetdex = currentSetdexInfo.setdex;
            currentGeneration = calc.Generations.get(currentGen);
            populateDefenderOptions(defenderSelect, currentSetdex, currentGeneration);
            setdexNote.textContent = 'Using Gen ' + currentGen + ' ' + currentSetdexInfo.label + ' setdex.';
            resultsStatus.textContent = 'Choose a defender and click Calculate.';
            resultsTableBody.innerHTML = '';
            if (tableHead) {
                tableHead.style.display = 'none';
            }
        });

        calculateButton.addEventListener('click', function () {
            var selectedValue = defenderSelect.value;
            if (!selectedValue) return;
            var defenderChoice = parseDefenderSelection(selectedValue);
            var defenderSet = currentSetdex[defenderChoice.pokemon][defenderChoice.setName];
            if (!defenderSet) return;
            resultsStatus.textContent = 'Calculating...';
            var defender = buildPokemon(currentGeneration, defenderChoice.pokemon, defenderSet);
            if (!defender) {
                resultsStatus.textContent = 'Defender not available in selected generation.';
                resultsTableBody.innerHTML = '';
                if (tableHead) {
                    tableHead.style.display = 'none';
                }
                return;
            }
            var results = calculateTopDamage(defender, currentSetdex, currentGeneration);
            renderResults(resultsTable, resultsTableBody, resultsStatus, results);
        });
    }

    return {
        init: init,
    };
})();

document.addEventListener('DOMContentLoaded', function () {
    HARDCORE_TOP_DAMAGE.init();
});
