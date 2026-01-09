var HARDCORE_TOP_DAMAGE = (function () {
    var DEFAULT_LEVEL = 100;
    var MAX_RESULTS = 30;
    var GEN = 9;
    var statAliases = {
        hp: 'hp',
        at: 'atk',
        df: 'def',
        sa: 'spa',
        sd: 'spd',
        sp: 'spe',
        spc: 'spa',
    };

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
            if (mappedKey) mapped[mappedKey] = stats[key];
        });
        return mapped;
    }

    function normalizeItem(item) {
        if (!item) return '';
        return item === 'Eviolite' || item.indexOf('ite') === -1 ? item : '';
    }

    function buildPokemon(generation, name, set) {
        return new calc.Pokemon(generation, name, {
            level: DEFAULT_LEVEL,
            ability: set.ability,
            abilityOn: true,
            item: normalizeItem(set.item),
            nature: set.nature || 'Serious',
            ivs: mapStats(set.ivs, 31),
            evs: mapStats(set.evs, 0),
        });
    }

    function populateDefenderOptions(defenderSelect, setdex) {
        var pokemonNames = Object.keys(setdex).sort();
        var defaultValue = 'Clodsire||Leader Misty';
        pokemonNames.forEach(function (pokemon) {
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

    function calculateTopDamage(defender, setdex, generation) {
        var field = new calc.Field();
        var results = [];
        Object.keys(setdex).forEach(function (pokemon) {
            Object.keys(setdex[pokemon]).forEach(function (setName) {
                var set = setdex[pokemon][setName];
                if (!set.moves || !set.moves.length) return;
                var attacker = buildPokemon(generation, pokemon, set);
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
                    var maxDamage = result.range()[1] * move.hits;
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
        var calculateButton = document.getElementById('calculate-button');
        var resultsTable = document.getElementById('results-table');
        var resultsTableBody = document.querySelector('#results-table tbody');
        var resultsStatus = document.getElementById('results-status');
        if (!defenderSelect || !calculateButton || !resultsTable || !resultsTableBody || !resultsStatus) return;

        var setdex = typeof SETDEX_SV !== 'undefined' ? SETDEX_SV : {};
        var generation = calc.Generations.get(GEN);
        populateDefenderOptions(defenderSelect, setdex);
        var tableHead = resultsTable.querySelector('thead');
        if (tableHead) {
            tableHead.style.display = 'none';
        }

        calculateButton.addEventListener('click', function () {
            var selectedValue = defenderSelect.value;
            if (!selectedValue) return;
            var defenderChoice = parseDefenderSelection(selectedValue);
            var defenderSet = setdex[defenderChoice.pokemon][defenderChoice.setName];
            if (!defenderSet) return;
            resultsStatus.textContent = 'Calculating...';
            var defender = buildPokemon(generation, defenderChoice.pokemon, defenderSet);
            var results = calculateTopDamage(defender, setdex, generation);
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
