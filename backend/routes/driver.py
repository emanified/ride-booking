from flask import Blueprint, request, jsonify
import store
from middleware.jwt_guard import token_required
from datetime import datetime
from utils.fare_calculator import validate_vehicle_type

driver_bp = Blueprint('driver', __name__)

CURRENT_YEAR = datetime.utcnow().year


@driver_bp.route('/broadcast-requests', methods=['GET'])
@token_required('driver')
def get_broadcast_requests():
    """Open (pending_driver) ride requests this driver can accept or bid on."""
    driver_id = request.user['user_id']
    driver_status = store.get_driver_status(driver_id)
    if not driver_status or not driver_status.get('isOnline'):
        return jsonify({'requests': [], 'message': 'You are offline'})

    requests = store.list_broadcast_requests_for_driver(driver_id)
    return jsonify({'requests': requests})


def _can_respond_to_broadcast(driver_id):
    """Shared eligibility checks for accept-at-minimum and submit-offer."""
    driver_status = store.get_driver_status(driver_id)
    if not driver_status or not driver_status.get('isOnline'):
        return 'You must be online to respond to ride requests.'
    if store.driver_has_active_trip(driver_id):
        return 'You already have another active trip.'
    vehicle = store.get_vehicle_by_driver(driver_id)
    if not vehicle or not vehicle.get('isApproved'):
        return 'Your vehicle must be approved before responding to ride requests.'
    return None


@driver_bp.route('/broadcast-requests/<int:trip_id>/accept', methods=['POST'])
@token_required('driver')
def accept_broadcast_request(trip_id):
    driver_id = request.user['user_id']
    error = _can_respond_to_broadcast(driver_id)
    if error:
        return jsonify({'error': error}), 400

    result = store.driver_accept_at_minimum(trip_id, driver_id)
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400
    return jsonify({'success': True, 'message': 'Ride accepted at the requested fare.', 'tripId': trip_id, 'status': 'accepted'})


@driver_bp.route('/broadcast-requests/<int:trip_id>/offer', methods=['POST'])
@token_required('driver')
def offer_on_broadcast_request(trip_id):
    driver_id = request.user['user_id']
    error = _can_respond_to_broadcast(driver_id)
    if error:
        return jsonify({'error': error}), 400

    fare = (request.json or {}).get('fare')
    if fare is None:
        return jsonify({'error': 'fare is required'}), 400

    result = store.driver_submit_offer(trip_id, driver_id, fare)
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400
    return jsonify({'success': True, 'message': 'Offer submitted.', 'offer': result.get('offer')})


@driver_bp.route('/broadcast-requests/<int:trip_id>/decline', methods=['POST'])
@token_required('driver')
def decline_broadcast_request(trip_id):
    store.driver_decline_request(trip_id, request.user['user_id'])
    return jsonify({'success': True, 'message': 'Request hidden.'})


@driver_bp.route('/active-trip/<int:trip_id>', methods=['GET'])
@token_required('driver')
def get_active_trip(trip_id):
    trip = store.get_active_trip_view(trip_id, request.user['user_id'])
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    return jsonify({'trip': trip})


@driver_bp.route('/update-status/<int:trip_id>', methods=['PATCH'])
@token_required('driver')
def update_status(trip_id):
    driver_id = request.user['user_id']
    new_status = (request.json or {}).get('status')

    # Map older in_progress -> started for compatibility
    if new_status == 'in_progress':
        new_status = 'started'

    if new_status not in ('accepted', 'driver_arriving', 'arrived', 'started'):
        return jsonify({'error': 'Invalid status'}), 400

    result = store.update_trip_status(driver_id, trip_id, new_status)
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400

    return jsonify({'message': f'Trip status updated to {new_status}', 'status': new_status})


@driver_bp.route('/earnings', methods=['GET'])
@token_required('driver')
def get_earnings():
    earnings, total = store.list_driver_earnings(request.user['user_id'])
    summary = store.driver_earnings_summary(request.user['user_id'])
    return jsonify({'earnings': earnings, 'total_earnings': total, 'summary': summary})


@driver_bp.route('/ride-history', methods=['GET'])
@token_required('driver')
def get_driver_ride_history():
    rides = store.list_driver_ride_history(request.user['user_id'])
    return jsonify({'rides': rides})


# --- Phase 3: Vehicle management ---

def _validate_vehicle_payload(data, partial=False):
    """Validate vehicle fields. In partial (update) mode, only validate fields
    that are present in the payload."""
    errors = {}

    if not partial or 'type' in data:
        vtype = data.get('type')
        if not vtype:
            errors['type'] = 'Vehicle type is required'
        elif not validate_vehicle_type(vtype):
            errors['type'] = 'Vehicle type must be one of bike, mini, ac_car, premium'

    if not partial or 'model' in data:
        if not data.get('model'):
            errors['model'] = 'Model is required'

    if not partial or 'number' in data:
        if not data.get('number'):
            errors['number'] = 'Vehicle number is required'

    if not partial or 'color' in data:
        if not data.get('color'):
            errors['color'] = 'Color is required'

    if not partial or 'capacity' in data:
        capacity = data.get('capacity')
        try:
            if capacity is None or float(capacity) <= 0:
                errors['capacity'] = 'Capacity must be a positive number'
        except (TypeError, ValueError):
            errors['capacity'] = 'Capacity must be a positive number'

    if 'year' in data and data.get('year') not in (None, ''):
        try:
            year = int(data['year'])
            if year < 1980 or year > CURRENT_YEAR + 1:
                errors['year'] = 'Year is invalid'
        except (TypeError, ValueError):
            errors['year'] = 'Year is invalid'

    return errors


def _clean_vehicle_data(data, partial=False):
    cleaned = {}
    if not partial or 'type' in data:
        cleaned['type'] = data.get('type')
    if not partial or 'model' in data:
        cleaned['model'] = data.get('model')
    if not partial or 'number' in data:
        cleaned['number'] = data.get('number')
    if not partial or 'color' in data:
        cleaned['color'] = data.get('color')
    if not partial or 'capacity' in data:
        cleaned['capacity'] = int(data['capacity']) if float(data['capacity']).is_integer() else float(data['capacity'])
    if 'brand' in data:
        cleaned['brand'] = data.get('brand', '')
    if 'year' in data and data.get('year') not in (None, ''):
        cleaned['year'] = int(data['year'])
    return cleaned


@driver_bp.route('/vehicle', methods=['POST'])
@token_required('driver')
def create_vehicle():
    driver_id = request.user['user_id']
    data = request.json or {}

    if store.get_vehicle_by_driver(driver_id):
        return jsonify({'error': 'You already have a vehicle on file. Edit it instead of adding a new one.'}), 400

    errors = _validate_vehicle_payload(data)
    if errors:
        return jsonify({'error': 'Please fix the highlighted fields', 'fields': errors}), 400

    if store.find_vehicle_by_number(data['number']):
        return jsonify({'error': 'This vehicle number is already registered'}), 400

    cleaned = _clean_vehicle_data(data)
    vehicle = store.create_vehicle(driver_id, cleaned)
    return jsonify({'success': True, 'vehicle': store.serialize_vehicle(vehicle)}), 201


@driver_bp.route('/vehicle', methods=['GET'])
@token_required('driver')
def get_my_vehicle():
    vehicle = store.get_vehicle_by_driver(request.user['user_id'])
    return jsonify({'vehicle': store.serialize_vehicle(vehicle)})


@driver_bp.route('/vehicle/<int:vehicle_id>', methods=['PUT'])
@token_required('driver')
def update_my_vehicle(vehicle_id):
    driver_id = request.user['user_id']
    vehicle = store.get_vehicle_by_id(vehicle_id)
    if not vehicle:
        return jsonify({'error': 'Vehicle not found'}), 404
    if vehicle['driverId'] != int(driver_id):
        return jsonify({'error': 'You cannot edit another driver\'s vehicle'}), 403

    data = request.json or {}
    errors = _validate_vehicle_payload(data, partial=True)
    if errors:
        return jsonify({'error': 'Please fix the highlighted fields', 'fields': errors}), 400

    if 'number' in data and data['number'] != vehicle.get('number'):
        if store.find_vehicle_by_number(data['number'], exclude_vehicle_id=vehicle_id):
            return jsonify({'error': 'This vehicle number is already registered'}), 400

    cleaned = _clean_vehicle_data(data, partial=True)
    # Any edit after approval (or rejection) must be reviewed again.
    updated = store.update_vehicle(vehicle_id, cleaned, reset_to_pending=True)
    return jsonify({'success': True, 'vehicle': store.serialize_vehicle(updated)})


@driver_bp.route('/vehicle/<int:vehicle_id>', methods=['DELETE'])
@token_required('driver')
def delete_my_vehicle(vehicle_id):
    driver_id = request.user['user_id']
    vehicle = store.get_vehicle_by_id(vehicle_id)
    if not vehicle:
        return jsonify({'error': 'Vehicle not found'}), 404
    if vehicle['driverId'] != int(driver_id):
        return jsonify({'error': 'You cannot delete another driver\'s vehicle'}), 403

    if store.driver_has_active_trip(driver_id):
        return jsonify({'error': 'Cannot delete vehicle while you have an active trip'}), 400

    store.delete_vehicle(vehicle_id)
    return jsonify({'message': 'Vehicle deleted'})

# ============================================================
# Phase 4 — Location & Online/Offline routes
# ============================================================

def _validate_latlng(data):
    """Extract and validate lat/lng from request body. Returns (lat, lng) or raises ValueError."""
    lat = data.get('lat')
    lng = data.get('lng')
    if lat is None or lng is None:
        raise ValueError('lat and lng are required')
    try:
        lat_f, lng_f = float(lat), float(lng)
    except (TypeError, ValueError):
        raise ValueError('lat and lng must be numbers')
    if not (-90 <= lat_f <= 90):
        raise ValueError('lat must be between -90 and 90')
    if not (-180 <= lng_f <= 180):
        raise ValueError('lng must be between -180 and 180')
    return lat_f, lng_f


@driver_bp.route('/go-online', methods=['POST'])
@token_required('driver')
def go_online():
    data = request.json or {}
    try:
        lat, lng = _validate_latlng(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    try:
        store.set_driver_online(request.user['user_id'], lat, lng)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({
        'success': True,
        'message': 'You are now online and available.',
        'isOnline': True,
        'isAvailable': True,
        'lat': lat,
        'lng': lng,
    })


@driver_bp.route('/go-offline', methods=['POST'])
@token_required('driver')
def go_offline():
    store.set_driver_offline(request.user['user_id'])
    return jsonify({'success': True, 'message': 'You are now offline.', 'isOnline': False, 'isAvailable': False})


@driver_bp.route('/location', methods=['POST'])
@token_required('driver')
def update_location():
    data = request.json or {}
    try:
        lat, lng = _validate_latlng(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    store.update_driver_location(request.user['user_id'], lat, lng)
    return jsonify({'success': True, 'message': 'Location updated.', 'lat': lat, 'lng': lng})


@driver_bp.route('/status', methods=['GET'])
@token_required('driver')
def driver_status():
    status = store.get_driver_status(request.user['user_id'])
    if not status:
        return jsonify({'error': 'Driver not found'}), 404
    return jsonify({'status': status})


@driver_bp.route('/assigned-trips', methods=['GET'])
@token_required('driver')
def assigned_trips():
    """Phase 4: return trips assigned to this driver via nearest-driver matching."""
    trips = store.get_assigned_trips_for_driver(request.user['user_id'])
    return jsonify({'trips': trips})


@driver_bp.route('/trips/<int:trip_id>/location', methods=['POST'])
@token_required('driver')
def update_trip_location(trip_id):
    data = request.json or {}
    lat = data.get('lat')
    lng = data.get('lng')
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng are required'}), 400
    try:
        lat_f, lng_f = float(lat), float(lng)
    except (TypeError, ValueError):
        return jsonify({'error': 'lat and lng must be numbers'}), 400

    # Ensure trip exists and driver is assigned
    trip = store.find_trip(trip_id)
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    assigned_to = trip.get('driver_id')
    if assigned_to is None or int(assigned_to) != int(request.user['user_id']):
        return jsonify({'error': 'You are not the assigned driver for this trip'}), 403
    if trip.get('status') == 'completed':
        return jsonify({'error': 'Trip already completed'}), 400

    # Update both user location and trip snapshot. Accept optional `manual` flag
    manual = bool(data.get('manual', False))
    store.update_driver_trip_location(request.user['user_id'], trip_id, lat_f, lng_f, manual=manual)
    return jsonify({'success': True, 'message': 'Location updated'})



@driver_bp.route('/trips/<int:trip_id>/complete', methods=['POST'])
@token_required('driver')
def complete_trip(trip_id):
    driver_id = request.user['user_id']
    trip = store.find_trip(trip_id)
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    assigned_to = trip.get('driver_id')
    if assigned_to is None or int(assigned_to) != int(driver_id):
        return jsonify({'error': 'You are not the assigned driver for this trip'}), 403
    if trip.get('status') in ('awaiting_payment', 'completed'):
        return jsonify({'error': 'Trip already completed'}), 400
    if trip.get('status') == 'cancelled':
        return jsonify({'error': 'Trip was cancelled and cannot be completed'}), 400

    result = store.update_trip_status(driver_id, trip_id, 'awaiting_payment')
    if result.get('error'):
        return jsonify({'error': result.get('error')}), 400

    # Return updated trip summary
    updated = store.find_trip(trip_id)
    return jsonify({'success': True, 'message': 'Ride completed successfully.', 'trip': {'trip_id': updated['trip_id'], 'status': updated.get('status'), 'completedAt': updated.get('completedAt') or updated.get('completed_at')}})


@driver_bp.route('/trips/<int:trip_id>/events', methods=['GET'])
@token_required('driver')
def driver_trip_events(trip_id):
    # Verify driver has access to this trip (assigned/accepted)
    trip = store.find_trip(trip_id)
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    assigned_to = trip.get('driver_id')
    if assigned_to is None or int(assigned_to) != int(request.user['user_id']):
        return jsonify({'error': 'You are not assigned to this trip'}), 403
    events = store.get_trip_events(trip_id)
    return jsonify({'events': events})


@driver_bp.route('/trips/<int:trip_id>/messages', methods=['GET', 'POST'])
@token_required('driver')
def driver_trip_messages(trip_id):
    driver_id = request.user['user_id']
    trip = store.find_trip_for_driver(trip_id, driver_id)
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    if request.method == 'GET':
        msgs = store.list_messages_for_trip(trip_id)
        return jsonify({'messages': msgs})
    data = request.json or {}
    text = data.get('message', '').strip()
    passenger_id = trip.get('passenger_id')
    res = store.post_message(trip_id, driver_id, passenger_id, 'driver', text)
    if res.get('error'):
        return jsonify({'error': res.get('error')}), 400
    return jsonify({'success': True, 'message': res.get('message')})


@driver_bp.route('/trips/<int:trip_id>/messages/read', methods=['POST'])
@token_required('driver')
def mark_driver_trip_messages_read(trip_id):
    trip = store.find_trip_for_driver(trip_id, request.user['user_id'])
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    store.mark_messages_read(trip_id, 'driver')
    return jsonify({'success': True})
