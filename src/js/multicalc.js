var MULTICALC = (function () {
    var DEFAULT_LEVEL = 100;
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
    var GEN9 = calc.Generations.get(9);
    var SETDEX_SOURCES = [
        { gen: 1, label: 'Gen 1', setdex: typeof SETDEX_RBY === 'undefined' ? {} : SETDEX_RBY },
        { gen: 2, label: 'Gen 2', setdex: typeof SETDEX_GSC === 'undefined' ? {} : SETDEX_GSC },
        { gen: 3, label: 'Gen 3', setdex: typeof SETDEX_ADV === 'undefined' ? {} : SETDEX_ADV },
        { gen: 4, label: 'Gen 4', setdex: typeof SETDEX_DPP === 'undefined' ? {} : SETDEX_DPP },
        { gen: 5, label: 'Gen 5', setdex: typeof SETDEX_BW === 'undefined' ? {} : SETDEX_BW },
        { gen: 6, label: 'Gen 6', setdex: typeof SETDEX_XY === 'undefined' ? {} : SETDEX_XY },
        { gen: 7, label: 'Gen 7', setdex: typeof SETDEX_SM === 'undefined' ? {} : SETDEX_SM },
        { gen: 8, label: 'Gen 8', setdex: typeof SETDEX_SS === 'undefined' ? {} : SETDEX_SS },
        { gen: 9, label: 'Gen 9', setdex: typeof SETDEX_SV === 'undefined' ? {} : SETDEX_SV },
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

    function normalizeIVs() {
        var mapped = mapStats(undefined, 31);
        return clampStatRange(mapped, 0, 31);
    }

    function normalizeEVs() {
        return mapStats(undefined, 0);
    }

    function normalizeItem(item) {
        if (!item) return '';
        return item === 'Eviolite' || item.indexOf('ite') === -1 ? item : '';
    }

    function isHackmonSet(setName) {
        return setName && setName.indexOf('Hackmon') !== -1;
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

    function getSetdexPreference() {
        var params = new URLSearchParams(window.location.search);
        return params.get('setdex') === 'standard' ? 'standard' : 'hardcore';
    }

    function mergeSetdexSources() {
        var merged = {};
        var preferredGen9Setdex = typeof SETDEX_HARDCORE !== 'undefined' && getSetdexPreference() === 'hardcore'
            ? SETDEX_HARDCORE
            : SETDEX_SOURCES[SETDEX_SOURCES.length - 1].setdex;
        SETDEX_SOURCES.forEach(function (source) {
            var setdex = source.gen === 9 ? preferredGen9Setdex : source.setdex;
            Object.keys(setdex).forEach(function (pokemon) {
                if (!merged[pokemon]) merged[pokemon] = {};
                Object.keys(setdex[pokemon]).forEach(function (setName) {
                    var targetName = setName;
                    if (merged[pokemon][targetName]) {
                        targetName = setName + ' (' + source.label + ')';
                    }
                    merged[pokemon][targetName] = setdex[pokemon][setName];
                });
            });
        });
        return {
            setdex: merged,
            label: preferredGen9Setdex === (typeof SETDEX_HARDCORE === 'undefined' ? {} : SETDEX_HARDCORE)
                ? 'Hardcore'
                : 'Standard',
        };
    }

    function buildDefenderIndex(setdex, generation) {
        var pokemonNames = Object.keys(setdex).sort();
        var speciesIdCache = {};
        var entries = [];
        pokemonNames.forEach(function (pokemon) {
            var cachedId = speciesIdCache[pokemon];
            if (!cachedId) {
                cachedId = calc.toID(pokemon);
                speciesIdCache[pokemon] = cachedId;
            }
            if (!generation.species.get(cachedId)) return;
            var setNames = Object.keys(setdex[pokemon]).sort();
            setNames.forEach(function (setName) {
                if (isHackmonSet(setName)) return;
                entries.push({
                    id: pokemon + '||' + setName,
                    pokemon: pokemon,
                    setName: setName,
                });
            });
        });
        return entries;
    }

    function getDefenderOption(entry) {
        return {
            id: entry.id,
            text: entry.pokemon + ' (' + entry.setName + ')',
            pokemon: entry.pokemon,
            setName: entry.setName,
        };
    }

    function matchesDefenderEntry(entry, term) {
        if (!term) return true;
        var pokemonName = entry.pokemon.toUpperCase();
        var setName = entry.setName.toUpperCase();
        return term.toUpperCase().split(' ').every(function (part) {
            return pokemonName.indexOf(part) === 0
                || pokemonName.indexOf('-' + part) >= 0
                || pokemonName.indexOf(' ' + part) >= 0
                || setName.indexOf(part) === 0
                || setName.indexOf('-' + part) >= 0
                || setName.indexOf(' ' + part) >= 0;
        });
    }

    function setDefenderSelection(defenderSelect, entry) {
        if (!entry) return;
        defenderSelect.value = entry.id;
    }

    function initDefenderSelect(defenderSelect, defenderIndex, defaultValue) {
        var defaultEntry = defenderIndex.find(function (entry) {
            return entry.id === defaultValue;
        }) || defenderIndex[0];
        setDefenderSelection(defenderSelect, defaultEntry);
        $(defenderSelect).select2({
            formatResult: function (entry) {
                return entry.text;
            },
            formatSelection: function (entry) {
                return entry.text;
            },
            query: function (query) {
                var pageSize = 30;
                var results = [];
                for (var i = 0; i < defenderIndex.length; i++) {
                    var entry = defenderIndex[i];
                    if (matchesDefenderEntry(entry, query.term || '')) {
                        results.push(getDefenderOption(entry));
                    }
                }
                query.callback({
                    results: results.slice((query.page - 1) * pageSize, query.page * pageSize),
                    more: results.length >= query.page * pageSize
                });
            },
            initSelection: function (element, callback) {
                var entry = defaultEntry;
                var value = element.val();
                if (value) {
                    entry = defenderIndex.find(function (option) {
                        return option.id === value;
                    }) || defaultEntry;
                }
                callback(entry ? getDefenderOption(entry) : null);
            }
        });
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

    function calculateTopDamage(defender, setdex, generation, allowedPokemonIds) {
        var field = new calc.Field();
        var results = [];
        var moveCache = {};
        Object.keys(setdex).forEach(function (pokemon) {
            if (allowedPokemonIds && !allowedPokemonIds[calc.toID(pokemon)]) return;
            Object.keys(setdex[pokemon]).forEach(function (setName) {
                if (isHackmonSet(setName)) return;
                var set = setdex[pokemon][setName];
                if (!set.moves || !set.moves.length) return;
                var attacker = buildPokemon(generation, pokemon, set);
                if (!attacker) return;
                var item = normalizeItem(set.item);
                var bestMove = null;
                set.moves.forEach(function (moveName) {
                    if (!moveName) return;
                    var cacheKey = moveName + '|' + (set.ability || '') + '|' + item + '|' + attacker.name;
                    // Cache moves per attacker/item/ability to reduce repeated instantiation.
                    var move = moveCache[cacheKey];
                    if (!move) {
                        move = new calc.Move(generation, moveName, {
                            ability: set.ability,
                            item: item,
                            species: attacker.name,
                        });
                        moveCache[cacheKey] = move;
                    }
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

    function populateRouteSelect(routeSelect) {
        if (!routeSelect) return false;
        var routes = window.ROUTE_DATA && ROUTE_DATA.getResolvedRoutes
            ? ROUTE_DATA.getResolvedRoutes()
            : [];
        if (!routes.length) return false;
        routeSelect.innerHTML = '';
        routes.forEach(function (route, index) {
            if (!route || !route.name) return;
            var option = document.createElement('option');
            option.value = index;
            option.textContent = route.name;
            routeSelect.appendChild(option);
        });
        if (!routeSelect.options.length) return false;
        routeSelect.disabled = false;
        routeSelect.value = routeSelect.options[routeSelect.options.length - 1].value;
        return true;
    }

    function initRouteSelect(routeSelect) {
        if (!routeSelect) return;
        routeSelect.disabled = true;
        routeSelect.innerHTML = '<option>Loading routes...</option>';
        if (populateRouteSelect(routeSelect)) return;
        var attempts = 0;
        var maxAttempts = 40;
        var interval = setInterval(function () {
            attempts += 1;
            if (populateRouteSelect(routeSelect)) {
                clearInterval(interval);
                return;
            }
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                routeSelect.innerHTML = '<option>Routes unavailable</option>';
            }
        }, 250);
    }

    function buildAllowedPokemonIds(routeSelect) {
        if (!routeSelect || routeSelect.disabled) return null;
        var routes = window.ROUTE_DATA && ROUTE_DATA.getResolvedRoutes
            ? ROUTE_DATA.getResolvedRoutes()
            : [];
        var routeIndex = parseInt(routeSelect.value, 10);
        if (!routes.length || isNaN(routeIndex) || routeIndex < 0) return null;
        var allowed = {};
        for (var i = 0; i <= routeIndex && i < routes.length; i++) {
            var route = routes[i];
            if (!route || !Array.isArray(route.encounters)) continue;
            route.encounters.forEach(function (encounter) {
                if (!encounter) return;
                allowed[calc.toID(encounter)] = true;
            });
        }
        return allowed;
    }

    function init() {
        var defenderSelect = document.getElementById('defender-select');
        var calculateButton = document.getElementById('calculate-button');
        var routeSelect = document.getElementById('route-select');
        var resultsTable = document.getElementById('results-table');
        var resultsTableBody = document.querySelector('#results-table tbody');
        var resultsStatus = document.getElementById('results-status');
        var setdexNote = document.getElementById('setdex-note');
        if (!defenderSelect || !calculateButton || !resultsTable || !resultsTableBody || !resultsStatus || !setdexNote) return;

        var currentSetdexInfo = mergeSetdexSources();
        var currentSetdex = currentSetdexInfo.setdex;
        var currentGeneration = GEN9;
        var defenderIndex = buildDefenderIndex(currentSetdex, currentGeneration);
        initDefenderSelect(defenderSelect, defenderIndex, 'Clodsire||Leader Misty');
        initRouteSelect(routeSelect);
        setdexNote.textContent = 'Using all gens ' + currentSetdexInfo.label + ' setdex with Gen 9 mechanics.';
        var tableHead = resultsTable.querySelector('thead');
        if (tableHead) {
            tableHead.style.display = 'none';
        }

        calculateButton.addEventListener('click', function () {
            var selectedValue = defenderSelect.value;
            if (!selectedValue) return;
            var defenderChoice = parseDefenderSelection(selectedValue);
            var defenderSet = currentSetdex[defenderChoice.pokemon][defenderChoice.setName];
            if (!defenderSet) return;
            resultsStatus.textContent = 'Calculating...';
            var defender = buildPokemon(currentGeneration, defenderChoice.pokemon, defenderSet);
            if (!defender) {
                resultsStatus.textContent = 'Defender not available with Gen 9 mechanics.';
                resultsTableBody.innerHTML = '';
                if (tableHead) {
                    tableHead.style.display = 'none';
                }
                return;
            }
            var allowedPokemonIds = buildAllowedPokemonIds(routeSelect);
            if (routeSelect && routeSelect.disabled) {
                resultsStatus.textContent = 'Route data is still loading.';
                return;
            }
            var results = calculateTopDamage(defender, currentSetdex, currentGeneration, allowedPokemonIds);
            renderResults(resultsTable, resultsTableBody, resultsStatus, results);
        });
    }

    return {
        init: init,
    };
})();

document.addEventListener('DOMContentLoaded', function () {
    MULTICALC.init();
});
