from flask import Blueprint, request, jsonify
import store
from middleware.jwt_guard import token_required
from utils.fare_calculator import calculate_fare, validate_vehicle_type, DEFAULT_VEHICLE_TYPE, CURRENCY

passenger_bp = Blueprint('passenger', __name__)

FARE_BASE = 2.5
FARE_PER_KM = 0.8


def estimate_fare(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng):
    """Legacy Haversine-based estimate, still used by /estimate-fare for older clients."""
    import math
    R = 6371
    lat1, lon1 = math.radians(pickup_lat), math.radians(pickup_lng)
    lat2, lon2 = math.radians(dropoff_lat), math.radians(dropoff_lng)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    distance_km = R * 2 * math.asin(math.sqrt(a))
    return round(FARE_BASE + distance_km * FARE_PER_KM, 2)


@passenger_bp.route('/estimate-fare', methods=['POST'])
@token_required('passenger')
def estimate_fare_route():
    data = request.json or {}
    pickup_lat = data.get('pickup_lat')
    pickup_lng = data.get('pickup_lng')
    dropoff_lat = data.get('dropoff_lat')
    dropoff_lng = data.get('dropoff_lng')

    if None in (pickup_lat, pickup_lng, dropoff_lat, dropoff_lng):
        return jsonify({'error': 'pickup and dropoff coordinates are required'}), 400

    fare = estimate_fare(
        float(pickup_lat), float(pickup_lng),
        float(dropoff_lat), float(dropoff_lng),
    )
    return jsonify({'fare': fare})


def _normalize_location(value):
    """
    Accept either a plain address string (Phase 1 format) or an object like
    { address, lat, lng, placeId } (Phase 2 Places Autocomplete / map format)
    and return a uniform (address, lat, lng, placeId) tuple. Keeps the endpoint
    backward compatible with any client still sending plain strings.
    """
    if isinstance(value, dict):
        return value.get('address'), value.get('lat'), value.get('lng'), value.get('placeId')
    return value, None, None, None


def _is_valid_latlng(lat, lng):
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return False
    return -90 <= lat_f <= 90 and -180 <= lng_f <= 180


def _is_positive_number(value):
    try:
        return float(value) > 0
    except (TypeError, ValueError):
        return False


@passenger_bp.route('/book-ride', methods=['POST'])
@token_required('passenger')
def book_ride():
    data = request.json or {}
    passenger_id = request.user['user_id']

    # Support both the existing flat fields (pickup_location/pickup_lat/pickup_lng)
    # and the nested { pickup: { address, lat, lng, placeId } } shape used by
    # Places Autocomplete and the map picker.
    pickup_address, pickup_obj_lat, pickup_obj_lng, pickup_place_id = _normalize_location(data.get('pickup'))
    dropoff_address, dropoff_obj_lat, dropoff_obj_lng, dropoff_place_id = _normalize_location(data.get('dropoff'))

    pickup = data.get('pickup_location', pickup_address)
    dropoff = data.get('dropoff_location', dropoff_address)
    pickup_lat = data.get('pickup_lat', pickup_obj_lat)
    pickup_lng = data.get('pickup_lng', pickup_obj_lng)
    dropoff_lat = data.get('dropoff_lat', dropoff_obj_lat)
    dropoff_lng = data.get('dropoff_lng', dropoff_obj_lng)

    # vehicleType (Phase 2) takes priority; vehicle_type (Phase 1) is the fallback.
    vehicle_type = data.get('vehicleType', data.get('vehicle_type', DEFAULT_VEHICLE_TYPE))
    estimate_in = data.get('estimate') or {}

    if not pickup:
        return jsonify({'error': 'pickup address is required'}), 400
    if not dropoff:
        return jsonify({'error': 'dropoff address is required'}), 400
    if pickup_lat is None or pickup_lng is None:
        return jsonify({'error': 'pickup coordinates are required'}), 400
    if dropoff_lat is None or dropoff_lng is None:
        return jsonify({'error': 'dropoff coordinates are required'}), 400
    if not _is_valid_latlng(pickup_lat, pickup_lng):
        return jsonify({'error': 'pickup coordinates are invalid'}), 400
    if not _is_valid_latlng(dropoff_lat, dropoff_lng):
        return jsonify({'error': 'dropoff coordinates are invalid'}), 400
    if not validate_vehicle_type(vehicle_type):
        return jsonify({'error': 'vehicleType is invalid'}), 400

    pickup_lat, pickup_lng = float(pickup_lat), float(pickup_lng)
    dropoff_lat, dropoff_lng = float(dropoff_lat), float(dropoff_lng)

    if pickup_lat == dropoff_lat and pickup_lng == dropoff_lng:
        return jsonify({'error': 'pickup and dropoff cannot be the same location'}), 400

    estimate = None
    if 'distanceKm' in estimate_in or 'durationMin' in estimate_in:
        # New Phase 2 flow: trust distance/duration (from OSRM routing or the
        # Haversine fallback) but never trust the fare the frontend computed —
        # recalculate it server-side using the same formula and verified rates.
        distance_km = estimate_in.get('distanceKm')
        duration_min = estimate_in.get('durationMin')
        if not _is_positive_number(distance_km):
            return jsonify({'error': 'estimate.distanceKm must be greater than 0'}), 400
        if duration_min is None or float(duration_min) < 0:
            return jsonify({'error': 'estimate.durationMin is invalid'}), 400

        distance_km = float(distance_km)
        duration_min = float(duration_min)
        verified_fare = calculate_fare(distance_km, duration_min, vehicle_type)

        estimate = {
            'distanceKm': round(distance_km, 2),
            'durationMin': round(duration_min),
            'fare': verified_fare,
            'currency': CURRENCY,
            'pricingSource': estimate_in.get('pricingSource', 'osrm'),
        }
        fare = verified_fare
    else:
        # Backward compatibility: Phase 1 clients with no estimate object at all.
        fare = estimate_fare(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)

    coords = {
        'pickup_lat': pickup_lat,
        'pickup_lng': pickup_lng,
        'dropoff_lat': dropoff_lat,
        'dropoff_lng': dropoff_lng,
    }

    # Broadcast model: no driver is pre-matched. The trip starts open
    # ('pending_driver') and any online driver with a matching vehicle type
    # can accept it at this fare or submit a counter-offer.
    trip_id, trip_doc = store.create_trip_broadcast(
        passenger_id, pickup, dropoff, coords, fare, vehicle_type,
        pickup_place_id=pickup_place_id, dropoff_place_id=dropoff_place_id,
        estimate=estimate,
    )

    passenger = store.find_user_by_id(passenger_id)

    return jsonify({
        'trip_id': trip_id,
        'fare': fare,
        'estimate': estimate,
        'message': 'Ride requested. Waiting for a driver to accept or offer a fare.',
        'passenger_name': passenger['name'] if passenger else '',
        'success': True,
        'status': 'pending_driver',
        'driverAssigned': False,
        'estimatedFare': fare,
    }), 201


@passenger_bp.route('/ride-status/<int:trip_id>', methods=['GET'])
@token_required('passenger')
def ride_status(trip_id):
    trip = store.get_trip_status_view_phase4(trip_id, request.user['user_id'])
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404

    return jsonify({
        'trip': trip,
        'events': store.get_trip_events(trip_id),
    })


@passenger_bp.route('/trips/<int:trip_id>/offers/<int:offer_id>/accept', methods=['POST'])
@token_required('passenger')
def accept_driver_offer(trip_id, offer_id):
    result = store.passenger_accept_offer(trip_id, request.user['user_id'], offer_id)
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400
    return jsonify({'success': True, 'message': 'Offer accepted.'})


@passenger_bp.route('/trips/<int:trip_id>/offers/<int:offer_id>/reject', methods=['POST'])
@token_required('passenger')
def reject_driver_offer(trip_id, offer_id):
    result = store.passenger_reject_offer(trip_id, request.user['user_id'], offer_id)
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400
    return jsonify({'success': True, 'message': 'Offer rejected.'})


@passenger_bp.route('/trips/<int:trip_id>/cancel', methods=['POST'])
@token_required('passenger')
def cancel_trip(trip_id):
    passenger_id = request.user['user_id']
    reason = (request.json or {}).get('reason')
    result = store.cancel_trip_by_passenger(passenger_id, trip_id, reason)
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400
    return jsonify({'success': True, 'message': 'Ride cancelled.', 'trip': result.get('trip')})


@passenger_bp.route('/trips/<int:trip_id>/pay', methods=['POST'])
@token_required('passenger')
def pay_for_trip(trip_id):
    passenger_id = request.user['user_id']
    result = store.pay_trip_by_passenger(passenger_id, trip_id)
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400
    return jsonify({'success': True, 'message': 'Payment completed successfully.', 'payment': result.get('payment'), 'driverEarningsUpdated': result.get('driverEarningsUpdated', False)})


@passenger_bp.route('/trips/<int:trip_id>/messages', methods=['GET', 'POST'])
@token_required('passenger')
def trip_messages(trip_id):
    passenger_id = request.user['user_id']
    trip = store.find_trip_for_passenger(trip_id, passenger_id)
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    if request.method == 'GET':
        msgs = store.list_messages_for_trip(trip_id)
        return jsonify({'messages': msgs})
    data = request.json or {}
    text = data.get('message', '').strip()
    # Receiver is driver
    driver_id = trip.get('driver_id')
    if not driver_id:
        return jsonify({'error': 'No driver assigned to this trip'}), 400
    res = store.post_message(trip_id, passenger_id, driver_id, 'passenger', text)
    if res.get('error'):
        return jsonify({'error': res.get('error')}), 400
    return jsonify({'success': True, 'message': res.get('message')})


@passenger_bp.route('/trips/<int:trip_id>/messages/read', methods=['POST'])
@token_required('passenger')
def mark_trip_messages_read(trip_id):
    trip = store.find_trip_for_passenger(trip_id, request.user['user_id'])
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    store.mark_messages_read(trip_id, 'passenger')
    return jsonify({'success': True})


@passenger_bp.route('/ride-history', methods=['GET'])
@token_required('passenger')
def ride_history():
    rides = store.list_passenger_history(request.user['user_id'])
    return jsonify({'rides': rides})


@passenger_bp.route('/rate-driver/<int:trip_id>', methods=['POST'])
@token_required('passenger')
def rate_driver(trip_id):
    data = request.json or {}
    passenger_id = request.user['user_id']
    rating = data.get('rating')
    comment = data.get('comment', '')

    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return jsonify({'error': 'rating must be a number between 1 and 5'}), 400
    if rating < 1 or rating > 5:
        return jsonify({'error': 'rating must be between 1 and 5'}), 400

    trip = store.find_trip_for_passenger(trip_id, passenger_id)
    if not trip or trip['status'] != 'completed' or not trip.get('driver_id'):
        return jsonify({'error': 'Trip not found or not completed'}), 404

    if store.trip_already_reviewed(trip['driver_id'], trip_id):
        return jsonify({'error': 'You have already rated this trip'}), 400

    passenger = store.find_user_by_id(passenger_id)
    avg = store.add_driver_review(
        trip['driver_id'],
        trip_id,
        passenger_id,
        passenger['name'] if passenger else '',
        rating,
        comment,
    )

    return jsonify({'message': 'Rating submitted', 'new_avg': avg})