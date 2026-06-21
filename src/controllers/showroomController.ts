import { Request, Response } from 'express';
import ShowroomContent from '../models/ShowroomContent';
import { AuthRequest } from '../middleware/auth';

/**
 * Get showroom content
 */
export const getShowroomContent = async (req: Request, res: Response) => {
  try {
    let content = await ShowroomContent.findOne();

    // If no content exists, create default
    if (!content) {
      content = await ShowroomContent.create({
        title: 'Notre',
        titleHighlight: 'Collection',
        subtitle: 'Découvrez nos créations en bois d\'exception et laissez-vous inspirer par notre savoir-faire artisanal.',
        ctaTitle: 'Vous ne trouvez pas ce que vous cherchez ?',
        ctaSubtitle: 'Nous créons également des pièces sur mesure selon vos spécifications exactes. Contactez-nous pour discuter de votre projet personnalisé.',
        ctaButtonText: 'Demander un Devis Gratuit',
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error('Error fetching showroom content:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du contenu showroom',
    });
  }
};

/**
 * Update showroom content (Admin only)
 */
export const updateShowroomContent = async (req: AuthRequest, res: Response) => {
  try {
    const { title, titleHighlight, subtitle, ctaTitle, ctaSubtitle, ctaButtonText } = req.body;

    // Validation
    if (!title || !titleHighlight || !subtitle || !ctaTitle || !ctaSubtitle || !ctaButtonText) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis',
      });
    }

    let content = await ShowroomContent.findOne();

    if (!content) {
      // Create new content
      content = await ShowroomContent.create({
        title,
        titleHighlight,
        subtitle,
        ctaTitle,
        ctaSubtitle,
        ctaButtonText,
        updatedBy: req.user?.email,
      });
    } else {
      // Update existing content
      content.title = title;
      content.titleHighlight = titleHighlight;
      content.subtitle = subtitle;
      content.ctaTitle = ctaTitle;
      content.ctaSubtitle = ctaSubtitle;
      content.ctaButtonText = ctaButtonText;
      content.updatedBy = req.user?.email;
      await content.save();
    }

    res.json({
      success: true,
      message: 'Contenu showroom mis à jour avec succès',
      data: content,
    });
  } catch (error) {
    console.error('Error updating showroom content:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du contenu showroom',
    });
  }
};
