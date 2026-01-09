var RouteNameResolver = (function () {
	function buildSetdexKeyIndex(setdexSources, toID) {
		var index = {};
		(setdexSources || []).forEach(function (setdex) {
			if (!setdex) return;
			Object.keys(setdex).forEach(function (pokemon) {
				var key = toID(pokemon);
				if (!key || index[key]) return;
				index[key] = pokemon;
			});
		});
		return index;
	}

	function addAlias(aliasMap, source, target, toID) {
		if (!source || !target) return;
		var key = toID(source);
		if (!key || aliasMap[key]) return;
		aliasMap[key] = target;
	}

	function buildAliasMap(pokemonEntries, toID) {
		var aliasMap = {};
		(pokemonEntries || []).forEach(function (entry) {
			if (!entry) return;
			var display = entry.label || entry.name;
			addAlias(aliasMap, entry.alias, display, toID);
			addAlias(aliasMap, entry.label, display, toID);
			addAlias(aliasMap, entry.name, display, toID);
		});
		return aliasMap;
	}

	function stripTrailingForm(name) {
		if (!name) return '';
		var lastDash = name.lastIndexOf('-');
		if (lastDash <= 0) return '';
		return name.slice(0, lastDash);
	}

	function resolveAlias(aliasMap, setdexKeyIndex, name, toID) {
		var alias = aliasMap[toID(name)];
		if (!alias) return null;
		var aliasKey = setdexKeyIndex[toID(alias)];
		return aliasKey || null;
	}

	function resolveEncounterName(name, resolver) {
		var normalized = resolver.toID(name);
		if (!normalized) return null;
		var direct = resolver.setdexKeyIndex[normalized];
		if (direct) return {key: direct, usedFallback: false};
		var aliasKey = resolveAlias(resolver.aliasMap, resolver.setdexKeyIndex, name, resolver.toID);
		if (aliasKey) return {key: aliasKey, usedFallback: false};
		var baseName = stripTrailingForm(name);
		if (baseName) {
			var baseDirect = resolver.setdexKeyIndex[resolver.toID(baseName)];
			if (baseDirect) return {key: baseDirect, usedFallback: true};
			var baseAlias = resolveAlias(resolver.aliasMap, resolver.setdexKeyIndex, baseName, resolver.toID);
			if (baseAlias) return {key: baseAlias, usedFallback: true};
		}
		return null;
	}

	function createResolver(options) {
		var toID = options.toID;
		var resolver = {
			toID: toID,
			setdexKeyIndex: buildSetdexKeyIndex(options.setdexSources, toID),
			aliasMap: buildAliasMap(options.pokemonData, toID)
		};
		resolver.resolve = function (name) {
			return resolveEncounterName(name, resolver);
		};
		return resolver;
	}

	return {
		createResolver: createResolver
	};
})();

if (typeof window !== 'undefined') {
	window.RouteNameResolver = RouteNameResolver;
}
