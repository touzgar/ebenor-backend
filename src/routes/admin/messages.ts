import { Router } from 'express';
import { messageController } from '../../controllers/messageController';
import { 
  validateObjectIdParam,
  validatePagination,
  validateMessageFilters,
  validatePriority,
  validateNote
} from '../../middleware/validation';

const router = Router();

/**
 * @route   GET /api/admin/messages
 * @desc    Obtenir tous les messages avec filtres et pagination
 * @access  Private (Admin)
 */
router.get('/', validatePagination, validateMessageFilters, messageController.getMessages);

/**
 * @route   GET /api/admin/messages/stats
 * @desc    Obtenir les statistiques des messages
 * @access  Private (Admin)
 */
router.get('/stats', messageController.getMessageStats);

/**
 * @route   GET /api/admin/messages/unread
 * @desc    Obtenir les messages non lus
 * @access  Private (Admin)
 */
router.get('/unread', messageController.getUnreadMessages);

/**
 * @route   GET /api/admin/messages/:id
 * @desc    Obtenir un message par son ID
 * @access  Private (Admin)
 */
router.get('/:id', validateObjectIdParam('id'), messageController.getMessageById);

/**
 * @route   PUT /api/admin/messages/:id/read
 * @desc    Marquer un message comme lu
 * @access  Private (Admin)
 */
router.put('/:id/read', validateObjectIdParam('id'), messageController.markAsRead);

/**
 * @route   PUT /api/admin/messages/:id/replied
 * @desc    Marquer un message comme répondu
 * @access  Private (Admin)
 */
router.put('/:id/replied', validateObjectIdParam('id'), messageController.markAsReplied);

/**
 * @route   PUT /api/admin/messages/:id/archive
 * @desc    Archiver un message
 * @access  Private (Admin)
 */
router.put('/:id/archive', validateObjectIdParam('id'), messageController.archiveMessage);

/**
 * @route   PUT /api/admin/messages/:id/priority
 * @desc    Changer la priorité d'un message
 * @access  Private (Admin)
 */
router.put('/:id/priority', validateObjectIdParam('id'), validatePriority, messageController.changePriority);

/**
 * @route   POST /api/admin/messages/:id/notes
 * @desc    Ajouter une note à un message
 * @access  Private (Admin)
 */
router.post('/:id/notes', validateObjectIdParam('id'), validateNote, messageController.addNote);

/**
 * @route   POST /api/admin/messages/:id/reply
 * @desc    Répondre à un message par email
 * @access  Private (Admin)
 */
router.post('/:id/reply', validateObjectIdParam('id'), messageController.replyByEmail);

export default router;
