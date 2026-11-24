from flask import Blueprint, request, jsonify
import store
from middleware.jwt_guard import token_required

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/notifications', methods=['GET'])
@token_required()
def list_notifications():
    user = request.user
    notifs = store.list_notifications_for_user(user['user_id'], role=user.get('role'))
    return jsonify({'notifications': notifs})

@notifications_bp.route('/notifications/<string:notification_id>/read', methods=['POST'])
@token_required()
def mark_read(notification_id):
    user = request.user
    try:
        from bson import ObjectId
        oid = ObjectId(notification_id)
    except Exception:
        return jsonify({'error': 'Invalid notification id'}), 400
    ok = store.mark_notification_read(oid, user['user_id'])
    if not ok:
        return jsonify({'error': 'Notification not found or not owned by user'}), 404
    return jsonify({'success': True})

@notifications_bp.route('/notifications/read-all', methods=['POST'])
@token_required()
def read_all():
    user = request.user
    res = store._db().notifications.update_many({'userId': int(user['user_id'])}, {'$set': {'isRead': True}})
    return jsonify({'success': True, 'modified': res.modified_count})
