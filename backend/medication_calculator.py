"""
Medication level calculator

This module calculates medication levels over time based on injection history.
To be honest, I have no idea what I'm doing here 
but I tuned it so it matches some graphs from other apps / sources.
"""
import datetime
from typing import List, Dict, Any
import numpy as np
from scipy.integrate import odeint


# ------------------------------------------------------
# PK parameters (typical from FDA popPK review)
# ------------------------------------------------------
CL_apparent = 0.038   # L/h (apparent clearance, CL/F)
Vc = 2.47              # L (central volume)
Vp = 4.82              # L (peripheral volume)
Q = 0.116              # L/h (intercompartmental clearance)
ka = 0.0373            # h^-1 (absorption rate constant)
F = 0.62               # bioavailability (solution formulation)
Vdss_reported = 10.3   # L (reported steady-state volume)

# ------------------------------------------------------
# ODEs: absorption → central ↔ peripheral
# ------------------------------------------------------
def tzp_odes(y, t, ka, CL_apparent, Vc, Q, Vp):
    A_gut, A_c, A_p = y
    dA_gut_dt = -ka * A_gut
    dA_c_dt = ka * A_gut - (CL_apparent / Vc) * A_c - (Q / Vc) * A_c + (Q / Vp) * A_p
    dA_p_dt = (Q / Vc) * A_c - (Q / Vp) * A_p
    return [dA_gut_dt, dA_c_dt, dA_p_dt]


# ------------------------------------------------------
# Simulation function
# ------------------------------------------------------
def simulate(doses, F, ka, CL_apparent, Vc, Q, Vp, dt=0.5, extra_days_after_last=14):
    t_end = max(td for _, td in doses) + extra_days_after_last*24
    t = np.arange(0, t_end+dt, dt)
    A = np.zeros((len(t), 3))
    y = [0.0, 0.0, 0.0]
    doses_applied = set()  # Track which doses have been applied

    for i, ti in enumerate(t):
        # add doses at this time (into absorption depot)
        for D, td in doses:
            # Check if this dose should be applied at this time point and hasn't been applied yet
            if abs(ti - td) <= (dt/2.0) and td not in doses_applied:
                y[0] += F * D
                doses_applied.add(td)
        # integrate one step
        sol = odeint(tzp_odes, y, [ti, ti+dt], args=(ka, CL_apparent, Vc, Q, Vp))
        y = sol[-1].tolist()
        A[i,:] = y

    A_gut, A_c, A_p = A[:,0], A[:,1], A[:,2]
    A_total = A_c + A_p
    # central concentration (ng/mL)
    Cc_ng_per_mL = (A_c / Vc) * 1000.0
    return t, A_total, A_c, A_p, Cc_ng_per_mL


def calculate_medication_levels(jabs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Calculate medication levels over time based on injection history.
    
    Args:
        jabs: List of jab records, each containing:
            - date: datetime.date
            - time: datetime.time
            - dose: float (in mg)
            - notes: str (optional)
    
    Returns:
        List of dictionaries with:
            - datetime: ISO format datetime string
            - level: float (calculated medication level in mg)
    
    Example:
        >>> jabs = [
        ...     {"date": datetime.date(2025, 1, 1), "time": datetime.time(10, 0), "dose": 2.5},
        ...     {"date": datetime.date(2025, 1, 8), "time": datetime.time(10, 0), "dose": 2.5},
        ... ]
        >>> levels = calculate_medication_levels(jabs)
    """
    
    if not jabs:
        return []
    
    # Convert jabs to doses_list format: (dose in mg, time in hours since first dose)
    first_jab_datetime = datetime.datetime.combine(jabs[0]["date"], jabs[0]["time"])
    
    doses_list = []
    for jab in jabs:
        jab_datetime = datetime.datetime.combine(jab["date"], jab["time"])
        hours_since_first = (jab_datetime - first_jab_datetime).total_seconds() / 3600
        doses_list.append((jab["dose"], hours_since_first))
    
    # Run simulation
    t, A_total, A_c, A_p, Cc = simulate(doses_list, F, ka, CL_apparent, Vc, Q, Vp)
    
    Cmax = Cc.max()                     # ng/mL
    A_total_peak = A_total.max()        # mg
    Cmax_mg_per_L = Cmax / 1000.0
    amount_from_Cmax = Cmax_mg_per_L * Vdss_reported
    Veff_at_peak = A_total_peak / Cmax_mg_per_L

    # compute literature-style amount as time series
    A_lit = Cc / 1000.0 * Vdss_reported  # mg

    # Prepare output with datetime and mg (amount_from_Cmax)
    output = [] # list of dicts with datetime and level (mg)
    for ti, Ai in zip(t, A_lit):
        current_datetime = first_jab_datetime + datetime.timedelta(hours=ti)
        output.append({
            "datetime": current_datetime.isoformat(),
            "level": round(Ai, 2)
        })

    # sample to 1-hr intervals for output
    output_sampled = [entry for i, entry in enumerate(output) if i % 2 == 0]

    return output_sampled
