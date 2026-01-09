var ROUTE_DATA = (function () {
	var resolvedRoutes = [];
	var unresolvedEncounters = [];
	var fallbackEncounters = [];
	var resolver = null;

	function addSetdexSource(sources, setdex) {
		if (!setdex || !Object.keys(setdex).length) return;
		sources.push(setdex);
	}

	function collectSetdexSources() {
		var sources = [];
		addSetdexSource(sources, typeof SETDEX_RBY === 'undefined' ? null : SETDEX_RBY);
		addSetdexSource(sources, typeof SETDEX_GSC === 'undefined' ? null : SETDEX_GSC);
		addSetdexSource(sources, typeof SETDEX_ADV === 'undefined' ? null : SETDEX_ADV);
		addSetdexSource(sources, typeof SETDEX_DPP === 'undefined' ? null : SETDEX_DPP);
		addSetdexSource(sources, typeof SETDEX_BW === 'undefined' ? null : SETDEX_BW);
		addSetdexSource(sources, typeof SETDEX_XY === 'undefined' ? null : SETDEX_XY);
		addSetdexSource(sources, typeof SETDEX_SM === 'undefined' ? null : SETDEX_SM);
		addSetdexSource(sources, typeof SETDEX_SS === 'undefined' ? null : SETDEX_SS);
		addSetdexSource(sources, typeof SETDEX_SV === 'undefined' ? null : SETDEX_SV);
		addSetdexSource(sources, typeof SETDEX_HARDCORE === 'undefined' ? null : SETDEX_HARDCORE);
		return sources;
	}

	function copyRoute(route) {
		var copied = {};
		Object.keys(route || {}).forEach(function (key) {
			copied[key] = route[key];
		});
		return copied;
	}

	function normalizeRoutes(routes, resolver) {
		var unresolved = {};
		var fallback = {};
		var normalizedRoutes = [];
		(routes || []).forEach(function (route) {
			var resolvedRoute = copyRoute(route);
			if (route && Array.isArray(route.encounters)) {
				resolvedRoute.encounters = route.encounters.map(function (encounter) {
					if (typeof encounter !== 'string') return encounter;
					var result = resolver.resolve(encounter);
					if (!result || !result.key) {
						unresolved[encounter] = true;
						return null;
					}
					if (result.usedFallback) fallback[encounter] = true;
					return result.key;
				}).filter(function (entry) {
					return entry;
				});
			}
			normalizedRoutes.push(resolvedRoute);
		});
		return {
			routes: normalizedRoutes,
			unresolved: Object.keys(unresolved).sort(),
			fallback: Object.keys(fallback).sort()
		};
	}

	function warnForUnresolved(encounters) {
		if (!encounters.length || typeof console === 'undefined') return;
		console.warn('[routes] Unresolved encounter names:', encounters);
	}

	function warnForFallback(encounters) {
		if (!encounters.length || typeof console === 'undefined') return;
		console.warn('[routes] Falling back to base species for encounters:', encounters);
	}

	function init() {
		if (!window.calc || !calc.toID || !window.RouteNameResolver || !window.$) return;
		var setdexSources = collectSetdexSources();
		if (!setdexSources.length) return;
		$.when(
			$.getJSON('./js/data/routes.json'),
			$.getJSON('./js/data/pokemon.json')
		).done(function (routesResponse, pokemonResponse) {
			var routes = routesResponse[0];
			var pokemonData = pokemonResponse[0];
			resolver = RouteNameResolver.createResolver({
				setdexSources: setdexSources,
				pokemonData: pokemonData,
				toID: calc.toID
			});
			var normalized = normalizeRoutes(routes, resolver);
			resolvedRoutes = normalized.routes;
			unresolvedEncounters = normalized.unresolved;
			fallbackEncounters = normalized.fallback;
			warnForFallback(fallbackEncounters);
			warnForUnresolved(unresolvedEncounters);
		}).fail(function () {
			if (typeof console !== 'undefined') {
				console.warn('[routes] Failed to load route encounter data.');
			}
		});
	}

	return {
		init: init,
		getResolvedRoutes: function () {
			return resolvedRoutes.slice();
		},
		getUnresolvedEncounters: function () {
			return unresolvedEncounters.slice();
		},
		getFallbackEncounters: function () {
			return fallbackEncounters.slice();
		},
		getResolver: function () {
			return resolver;
		}
	};
})();

$(document).ready(function () {
	if (window.ROUTE_DATA && ROUTE_DATA.init) {
		ROUTE_DATA.init();
	}
});
