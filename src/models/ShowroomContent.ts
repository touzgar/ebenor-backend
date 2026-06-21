import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IShowroomContent extends Document {
  title: string;
  titleHighlight: string;
  subtitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonText: string;
  updatedAt: Date;
  updatedBy?: string;
}

const ShowroomContentSchema = new Schema<IShowroomContent>(
  {
    title: {
      type: String,
      required: true,
      default: 'Notre',
    },
    titleHighlight: {
      type: String,
      required: true,
      default: 'Collection',
    },
    subtitle: {
      type: String,
      required: true,
      default: 'Découvrez nos créations en bois d\'exception et laissez-vous inspirer par notre savoir-faire artisanal.',
    },
    ctaTitle: {
      type: String,
      required: true,
      default: 'Vous ne trouvez pas ce que vous cherchez ?',
    },
    ctaSubtitle: {
      type: String,
      required: true,
      default: 'Nous créons également des pièces sur mesure selon vos spécifications exactes. Contactez-nous pour discuter de votre projet personnalisé.',
    },
    ctaButtonText: {
      type: String,
      required: true,
      default: 'Demander un Devis Gratuit',
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const ShowroomContent = (mongoose.models.ShowroomContent as Model<IShowroomContent>) || mongoose.model<IShowroomContent>('ShowroomContent', ShowroomContentSchema);

export default ShowroomContent;
