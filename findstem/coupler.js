"use strict"

var overlapInfo = require('./overlap').overlapInfo;
var by_start = function (p, q) { return p[0].xori - q[0].xori };

function segmentInRadical(z, zkey, radical) {
	var SEGMENTS = 64;
	for (var s = 1; s < SEGMENTS; s++) {
		var testz = {
			xori: zkey.xori + (z.xori - zkey.xori) * (s / SEGMENTS),
			yori: zkey.yori + (z.yori - zkey.yori) * (s / SEGMENTS)
		}
		if (!radical.includes(testz)) {
			return false
		}
	}
	return true;
}

function segmentJoinable(pivot, segment, radical) {
	for (var k = 0; k < pivot.length; k++) {
		for (var j = 0; j < segment.length; j++) {
			if (segmentInRadical(segment[j], pivot[k], radical)) {
				return true;
			}
		}
	}
	return false;
}

function segmentTetragonalInRadical(s1, s2, radical) {
	var steps = 32;
	for (var j = 1; j < steps; j++) {
		var m1 = {
			xori: s1[0].xori + (s1[1].xori - s1[0].xori) * (j / steps),
			yori: s1[0].yori + (s1[1].yori - s1[0].yori) * (j / steps)
		}
		var m2 = {
			xori: s2[0].xori + (s2[1].xori - s2[0].xori) * (j / steps),
			yori: s2[0].yori + (s2[1].yori - s2[0].yori) * (j / steps)
		}
		if (!segmentInRadical(m1, m2, radical)) return false;
		var m1 = {
			xori: s1[0].xori + (s1[1].xori - s1[0].xori) * (j / steps),
			yori: s1[0].yori + (s1[1].yori - s1[0].yori) * (j / steps)
		}
		var m2 = {
			xori: s2[0].xori + (s2[1].xori - s2[0].xori) * (1 - j / steps),
			yori: s2[0].yori + (s2[1].yori - s2[0].yori) * (1 - j / steps)
		}
		if (!segmentInRadical(m1, m2, radical)) return false;
	}
	return true;
}

function segmentPairable(u, v, radical) {
	for (var s = 0; s < u.length; s++) {
		for (var r = 0; r < v.length; r++) {
			if (!segmentTetragonalInRadical(u[s], v[r], radical)) return false;
		}
	}
	return true;
}
function minmaxOfSeg(u) {
	var min = 0xFFFF, max = -0xFFFF;
	for (var s = 0; s < u.length; s++)for (var k = 0; k < u[s].length; k++) {
		if (u[s][k].xori < min) min = u[s][k].xori
		if (u[s][k].xori > max) max = u[s][k].xori
	}
	return { min: min, max: max }
}
function isVertical(u, v) {
	var d1 = minmaxOfSeg(u);
	var d2 = minmaxOfSeg(v);
	return Math.max(d1.max, d2.max) - Math.min(d1.min, d2.min) < Math.abs(u[0][0].yori - v[0][0].yori) * 0.9;
}

// Stemfinding
function findHorizontalSegments(radicals, strategy) {
	var segments = []
	for (var r = 0; r < radicals.length; r++) {
		radicals[r].mergedSegments = [];
		var radicalParts = [radicals[r].outline].concat(radicals[r].holes);
		for (var j = 0; j < radicalParts.length; j++) {
			var contour = radicalParts[j];
			var lastPoint = contour.points[0]
			var segment = [lastPoint];
			segment.radical = r;
			for (var k = 1; k < contour.points.length - 1; k++) if (!contour.points[k].interpolated) {
				if (Math.abs((contour.points[k].yori - lastPoint.yori) / (contour.points[k].xori - lastPoint.xori)) <= strategy.SLOPE_FUZZ) {
					segment.push(contour.points[k])
					lastPoint = contour.points[k];
				} else {
					if (segment.length > 1) segments.push(segment)
					lastPoint = contour.points[k];
					segment = [lastPoint]
					segment.radical = r;
				}
			};
			if (Math.abs((contour.points[0].yori - lastPoint.yori) / (contour.points[0].xori - lastPoint.xori)) <= strategy.SLOPE_FUZZ) {
				segment.push(contour.points[0])
				segment.push(contour.points[contour.points.length - 1])
			}
			if (segment.length > 1) segments.push(segment)
		}
	}

	segments = segments.sort(function (p, q) { return p[0].xori - q[0].xori });

	// Join segments
	for (var j = 0; j < segments.length; j++) if (segments[j]) {
		var pivotRadical = segments[j].radical;
		radicals[pivotRadical].segments.push(segments[j]);
	}
}

function uuCouplable(sj, sk, radical, strategy) {
	return Math.abs(sj[0].yori - sk[0].yori) <= strategy.Y_FUZZ && segmentJoinable(sj, sk, radical);
}
function udMatchable(sj, sk, radical, strategy) {
	//var segOverlap = overlapInfo([sj], [sk], strategy);
	return segmentTetragonalInRadical(sj, sk, radical);
}

function identifyStem(used, segs, candidates, graph, up, j, strategy) {
	var candidate = {
		high: [],
		low: []
	}
	var strat, end, delta;
	if (up[j]) {
		candidate.high.push(j);
	} else {
		candidate.low.push(j);
	}
	var rejected = [];
	used[j] = true;
	var succeed = false;
	var foundMatch = false;
	var rounds = 0;
	while (!foundMatch && rounds < 3) {
		rounds += 1;
		var expandingU = true;
		var expandingD = true;
		var pass = 0;
		while (expandingU || expandingD) {
			pass += 1;
			if (pass % 2) {
				expandingD = false;
			} else {
				expandingU = false;
			}
			for (var k = 0; k < segs.length; k++) if (!used[k] && (up[k] !== up[j]) === (!!(pass % 2))) {
				var sameSide, otherSide;
				if (up[k]) {
					sameSide = candidate.high;
					otherSide = candidate.low;
				} else {
					sameSide = candidate.low;
					otherSide = candidate.high;
				}
				var matchD = true;
				var matchU = !sameSide.length;
				for (var s = 0; s < sameSide.length; s++) {
					var hj = sameSide[s];
					if (graph[k][hj] === 1 || graph[hj][k] === 1) matchU = true;
				}
				for (var s = 0; s < otherSide.length; s++) {
					var hj = otherSide[s];
					if (graph[k][hj] !== 2 && graph[hj][k] !== 2) matchD = false;
				}
				if (matchU && matchD) {
					sameSide.push(k);
					if (pass % 2) {
						expandingD = true;
					} else {
						expandingU = true;
					}
					used[k] = true;
				}
			}
		}
		if (candidate.high.length && candidate.low.length) {
			foundMatch = true;
			var highEdge = candidate.high.map(function (x) { return segs[x] })
				.sort(function (a, b) { return a.xori - b.xori });
			var lowEdge = candidate.low.map(function (x) { return segs[x] })
				.sort(function (a, b) { return a.xori - b.xori });
			var segOverlap = overlapInfo(highEdge, lowEdge, strategy);
			var hasEnoughOverlap = (segOverlap.len / segOverlap.la >= strategy.COLLISION_MIN_OVERLAP_RATIO
				|| segOverlap.len / segOverlap.lb >= strategy.COLLISION_MIN_OVERLAP_RATIO);
			if (!isVertical(highEdge, lowEdge) && hasEnoughOverlap) {
				succeed = true;
				candidates.push({
					high: highEdge,
					low: lowEdge
				});
			}
		}

		if (foundMatch && !succeed) {
			// We found a stem match, but it is not good enough.
			// We will "reject" the corresponded edge for now, and release them in the future
			if (up[j]) {
				for (var k = 0; k < candidate.low.length; k++) {
					rejected[candidate.low[k]] = true;
				}
				candidate.low = [];
			} else {
				for (var k = 0; k < candidate.high.length; k++) {
					rejected[candidate.high[k]] = true;
				}
				candidate.high = [];
			}
			foundMatch = false;
		}
	}
	for (var k = 0; k < segs.length; k++) {
		if (rejected[k]) { used[k] = false }
	}
}

function pairSegmentsForRadical(radical, r, strategy) {
	var graph = [], up = [];
	var segs = radical.segments.sort(function (a, b) { return b[0].yori - a[0].yori });
	for (var j = 0; j < segs.length; j++) {
		graph[j] = [];
		for (var k = 0; k < segs.length; k++) {
			graph[j][k] = 0;
		}
	}
	for (var j = 0; j < segs.length; j++) {
		var sj = segs[j];
		var upperEdgeJ = radical.outline.ccw !== (sj[0].xori < sj[sj.length - 1].xori);
		up[j] = upperEdgeJ;
		for (var k = 0; k < j; k++) {
			var sk = segs[k];
			var upperEdgeK = radical.outline.ccw !== (sk[0].xori < sk[sk.length - 1].xori);
			if (upperEdgeJ === upperEdgeK) {
				// Both upper
				graph[j][k] = uuCouplable(sj, sk, radical, strategy) ? 1 : 0;
			} else {
				graph[j][k] = udMatchable(sj, sk, radical, strategy) ? 2 : 0;
			}
		}
	}
	var candidates = [];
	var used = [];
	for (var j = 0; j < segs.length; j++)if (!used[j]) {
		identifyStem(used, segs, candidates, graph, up, j, strategy);
	}
	return candidates.map(function (s) {
		return {
			high: s.high,
			low: s.low,
			yori: s.high[0][0].yori,
			width: Math.abs(s.high[0][0].yori - s.low[0][0].yori),
			belongRadical: r
		}
	});

}

function pairSegments(radicals, strategy) {
	var stems = [];
	for (var r = 0; r < radicals.length; r++) {
		var radicalStems = pairSegmentsForRadical(radicals[r], r, strategy);
		stems = stems.concat(radicalStems)
		radicals[r].stems = radicalStems;
	};
	return stems.sort(function (a, b) { return a.yori - b.yori });
};

// Symmetric stem pairing
function pairSymmetricStems(stems, strategy) {
	var res = [];
	for (var j = 0; j < stems.length; j++) {
		for (var k = j + 1; k < stems.length; k++) if (stems[j] && stems[k]) {
			var delta1 = stems[j].belongRadical === stems[k].belongRadical ? 0.002 : 0.005;
			var delta2 = stems[j].belongRadical === stems[k].belongRadical ? 0.001 : 0.003;
			if (
				Math.abs(stems[j].yori - stems[j].width / 2 - stems[k].yori + stems[k].width / 2) <= strategy.UPM * delta1 && Math.abs(stems[j].width - stems[k].width) <= strategy.UPM * delta1
			) {
				stems[j].high = stems[j].high.concat(stems[k].high);
				stems[j].low = stems[j].low.concat(stems[k].low);
				stems[k] = null
			}
		}
	};
	for (var j = 0; j < stems.length; j++) if (stems[j]) {
		res.push(stems[j])
	};
	return res;
};

module.exports = function (radicals, strategy) {
	findHorizontalSegments(radicals, strategy);
	return pairSymmetricStems(pairSegments(radicals, strategy), strategy);
}