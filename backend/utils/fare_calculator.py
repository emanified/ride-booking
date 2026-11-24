# Fare calculator utilities for backend verification

DEFAULT_VEHICLE_TYPE = 'mini'
CURRENCY = 'PKR'

VEHICLE_RATES = {
    'bike': {
        'baseFare': 50,
        'perKmRate': 35,
        'perMinuteRate': 2,
    },
    'mini': {
        'baseFare': 100,
        'perKmRate': 60,
        'perMinuteRate': 3,
    },
    'ac_car': {
        'baseFare': 150,
        'perKmRate': 85,
        'perMinuteRate': 4,
    },
    'premium': {
        'baseFare': 250,
        'perKmRate': 120,
        'perMinuteRate': 6,
    },
}


# Phase 3: display labels for the same vehicle type keys used for fare rates.
VEHICLE_TYPE_LABELS = {
    'bike': 'Bike',
    'mini': 'Mini',
    'ac_car': 'AC Car',
    'premium': 'Premium',
}


def validate_vehicle_type(vtype):
    return vtype in VEHICLE_RATES


def vehicle_type_label(vtype):
    return VEHICLE_TYPE_LABELS.get(vtype, vtype)


def calculate_fare(distance_km, duration_min, vehicle_type):
    """Recalculate the fare on the server using the same formula as frontend.

    Returns an integer fare (rounded to nearest rupee).
    """
    if not validate_vehicle_type(vehicle_type):
        vehicle_type = DEFAULT_VEHICLE_TYPE
    cfg = VEHICLE_RATES[vehicle_type]
    fare = cfg['baseFare'] + (distance_km * cfg['perKmRate']) + (duration_min * cfg['perMinuteRate'])
    # Round to nearest whole rupee
    return int(round(fare))
