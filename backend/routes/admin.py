from flask import Blueprint, request, jsonify
import store
from middleware.jwt_guard import token_required

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/stats', methods=['GET'])
@token_required('admin')
def get_stats():
    return jsonify({
        'total_passengers': store.count_users('passenger'),
        'total_drivers': store.count_users('driver'),
        'completed_trips': store.count_trips('completed'),
        'active_trips': store.count_active_trips(),
        'total_revenue': store.sum_completed_payments(),
    })


@admin_bp.route('/users', methods=['GET'])
@token_required('admin')
def get_users():
    role = request.args.get('role')
    status = request.args.get('status')
    return jsonify({'users': store.list_users(role=role, status=status)})


@admin_bp.route('/suspend-user/<int:user_id>', methods=['PATCH'])
@token_required('admin')
def suspend_user(user_id):
    action = (request.json or {}).get('action')
    is_active = action != 'suspend'
    store.set_user_active(user_id, is_active)
    return jsonify({'message': f"User {'activated' if is_active else 'suspended'}"})


@admin_bp.route('/trips', methods=['GET'])
@token_required('admin')
def get_trips():
    status = request.args.get('status')
    return jsonify({'trips': store.list_admin_trips(status=status)})


@admin_bp.route('/payments', methods=['GET'])
@token_required('admin')
def get_payments():
    return jsonify({'payments': store.list_admin_payments()})


@admin_bp.route('/analytics', methods=['GET'])
@token_required('admin')
def analytics():
    # Basic aggregations for Phase 8
    totalPassengers = store.count_users('passenger')
    totalDrivers = store.count_users('driver')
    db = store._db()
    activeDrivers = db.users.count_documents({'role': 'driver', 'isOnline': True})
    totalRides = db.trips.count_documents({})
    completedRides = store.count_trips('completed')
    cancelledRides = store.count_trips('cancelled')
    paidPayments = db.payments.count_documents({'status': 'completed'})
    totalRevenue = store.sum_completed_payments()
    agg = list(db.driver_earnings.aggregate([{'$group': {'_id': None, 'total': {'$sum': '$netAmount'}}}]))
    totalDriverEarnings = float(agg[0]['total']) if agg else 0.0

    return jsonify({'success': True, 'analytics': {
        'users': {'totalPassengers': totalPassengers, 'totalDrivers': totalDrivers, 'activeDrivers': activeDrivers},
        'rides': {'total': totalRides, 'completed': completedRides, 'cancelled': cancelledRides},
        'payments': {'paidPayments': paidPayments, 'totalRevenue': totalRevenue},
        'earnings': {'totalDriverEarnings': totalDriverEarnings}
    }})


# --- Phase 3: Vehicle approvals ---

VALID_VEHICLE_STATUSES = ('pending', 'approved', 'rejected')


@admin_bp.route('/vehicles', methods=['GET'])
@token_required('admin')
def get_vehicles():
    status = request.args.get('status')
    if status and status not in VALID_VEHICLE_STATUSES:
        return jsonify({'error': 'Invalid status filter'}), 400
    return jsonify({'vehicles': store.get_vehicles(status=status)})


@admin_bp.route('/vehicles/<int:vehicle_id>/approve', methods=['PUT'])
@token_required('admin')
def approve_vehicle(vehicle_id):
    vehicle = store.get_vehicle_by_id(vehicle_id)
    if not vehicle:
        return jsonify({'error': 'Vehicle not found'}), 404

    updated = store.approve_vehicle(vehicle_id, request.user['user_id'])
    return jsonify({'success': True, 'vehicle': store.serialize_vehicle(updated)})


@admin_bp.route('/vehicles/<int:vehicle_id>/reject', methods=['PUT'])
@token_required('admin')
def reject_vehicle(vehicle_id):
    vehicle = store.get_vehicle_by_id(vehicle_id)
    if not vehicle:
        return jsonify({'error': 'Vehicle not found'}), 404

    reason = (request.json or {}).get('reason', '').strip()
    if not reason:
        return jsonify({'error': 'A rejection reason is required'}), 400

    updated = store.reject_vehicle(vehicle_id, reason)
    return jsonify({'success': True, 'vehicle': store.serialize_vehicle(updated)})
