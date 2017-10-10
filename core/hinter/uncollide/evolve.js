"use strict"

var Individual = require('./individual');
var balance = require("./balance");
function xclamp(low, x, high) { return x < low ? low : x > high ? high : x }

function crossover(p, q, r, env, background, c, allowUnbalanced) {
	var avails = env.avails;
	var n = p.gene.length;
	var newgene = new Array(n);
	for (var j = 0; j < p.gene.length; j++) {
		var rn = Math.random();
		if (rn < env.strategy.MUTANT_PROBABLITY) {
			newgene[j] = xclamp(
				avails[j].low,
				Math.round(avails[j].low - 0.5 + Math.random() * (avails[j].high - avails[j].low + 1)),
				avails[j].high);
		} else if (rn * 2 < 1 || rn * n < 1) {
			newgene[j] = xclamp(avails[j].low, p.gene[j] + (q.gene[j] - r.gene[j]), avails[j].high)
		} else {
			newgene[j] = p.gene[j];
		}
	}
	const idBal = new Individual(balance(newgene, env), env);
	const idUnbal = allowUnbalanced ? new Individual(newgene, env, true) : idBal;
	if (!background[c]) background[c] = p;
	if (idBal.fitness > p.fitness) {
		if (idUnbal.fitness > idBal.fitness) {
			background[c] = idUnbal
		} else {
			background[c] = idBal
		}
	} else {
		if (idUnbal.fitness > p.fitness) {
			background[c] = idUnbal
		}
	}
};
// Use a swapchain to avoid re-allochain
function evolve(p, q, odd, env, allowUnbalanced) {
	var population = odd ? p : q;
	var background = odd ? q : p;
	// Crossover
	for (var c = 0; c < population.length; c++) {
		var original = population[c];
		var m1 = population[0 | Math.random() * population.length];
		var m2 = population[0 | Math.random() * population.length];
		crossover(original, m1, m2, env, background, c, allowUnbalanced);
	};
	return background;
};

module.exports = evolve;