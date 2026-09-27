"""Deterministic rolling-horizon dispatch. Slack makes shortages explicit."""
from __future__ import annotations
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp


def optimize(devices: list[dict], needs: list[float], price: float, minute: int, radiation: float, faults: list[str]) -> dict:
    n, h = len(devices), len(needs)
    if not n or not h:
        return {"dispatch": [], "uncoveredKw": needs[0] if needs else 0, "schedule": [], "status": "empty"}
    # x[device, interval], unmet[interval]; quarter-hour energy constraints.
    count = n * h + h
    upper = np.zeros(count)
    objective = np.zeros(count)
    rows, low, high = [], [], []
    for i, d in enumerate(devices):
        kind = d['kind']
        cap = min(d['maxKw'], d.get('maxKwhPerEvent', d['maxKw']))
        if d.get('eventsToday',0) >= d.get('maxEventsPerDay',6): cap = 0
        reserve = max(d['reserve'], .8 if 'storm' in faults or 'reserve' in faults else 0)
        energy = float('inf')
        if kind == 'battery':
            energy = max(0, d['energyKwh'] - reserve * d['capacityKwh']) * .95
        elif kind == 'generator':
            energy = d['fuelKwh']
            if 'generator-limit' in faults: cap = 0
        elif kind == 'hvac':
            cap = min(cap, max(0, d['comfortMaxF'] - d['temperatureF']) * .4, d['baselineKw'])
            energy = cap * .5
            if 'hvac-limit' in faults: cap = 0
        elif kind == 'solar':
            cap = min(cap, cap * max(0, radiation) / 1000) * .2
        elif kind == 'ev':
            left = max(1, (d['departureMinute'] + (1440 if minute >= 1080 else 0)) - minute)
            desired = min(cap,max(0,d['targetKwh']-d['energyKwh'])*60/.9)
            cap = max(0, desired - max(0, d['targetKwh'] - d['energyKwh']) * 60 / (left * .9))
            if minute >= d['departureMinute'] and minute < 1080: cap = 0
        if not d['available'] or d['optedOut'] or d['minPrice'] > price or 'zero-procurement' in faults:
            cap = 0
        if 'partial-procurement' in faults: cap *= .25
        if 'device-offline' in faults and kind == 'battery': cap = 0
        if 'price-ineligible' in faults or 'declined' in faults or 'unanswered' in faults or 'opt-out' in faults:
            cap = 0
        for t in range(h):
            upper[i*h+t] = cap
            if kind == 'ev' and minute + t*15 >= d['departureMinute'] and minute + t*15 < 1080:
                upper[i*h+t] = 0
            objective[i*h+t] = d['minPrice'] * .25 + (0.04 if kind == 'generator' else 0) + i * 1e-7
        # The on-chain contract commits constant power for the first hour.
        for t in range(1,min(4,h)):
            row = np.zeros(count); row[i*h] = 1; row[i*h+t] = -1
            rows.append(row); low.append(0); high.append(0)
        if np.isfinite(energy):
            row = np.zeros(count); row[i*h:(i+1)*h] = .25
            rows.append(row); low.append(0); high.append(energy)
    for t, need in enumerate(needs):
        upper[n*h+t] = max(0, need)
        objective[n*h+t] = 1000 * .25 * .98**t
        row = np.zeros(count)
        for i in range(n): row[i*h+t] = 1
        row[n*h+t] = 1
        rows.append(row); low.append(max(0, need)); high.append(max(0, need))
    if 'optimizer-infeasible' in faults:
        return {"dispatch": [], "uncoveredKw": needs[0], "schedule": [], "status": "unavailable"}
    result = milp(objective, integrality=np.zeros(count), bounds=Bounds(np.zeros(count), upper),
                  constraints=LinearConstraint(np.array(rows), low, high), options={"time_limit": 2})
    if result.x is None:
        return {"dispatch": [], "uncoveredKw": needs[0], "schedule": [], "status": "unavailable"}
    schedule = result.x[:n*h].reshape(n, h)
    # Commit a constant one-hour output feasible in every interval of that hour.
    dispatch = [{"resourceId": d['id'], "kw": round(float(min(schedule[i, :min(4,h)])), 3),
                 "price": d['minPrice'], "baselineKw": d['baselineKw']} for i, d in enumerate(devices)]
    dispatch = [d for d in dispatch if d['kw'] > .01]
    return {"dispatch": dispatch, "uncoveredKw": max(0, needs[0] - sum(d['kw'] for d in dispatch)),
            "schedule": schedule.round(3).tolist(), "status": "optimal" if result.success else "feasible"}
