import type { Locale } from "@/lib/i18n/config";

/**
 * Terms and privacy texts. Draft: to be reviewed by a lawyer before launch
 * (see TODO.md). Bracketed values are placeholders for the company's details.
 */
export type LegalSection = { id: string; title: string; body: string };

const PRIVACY: Record<Locale, LegalSection[]> = {
  fr: [
    { id: "donnees", title: "1. Données que nous collectons", body: "Restaurateurs et leur équipe : nom, numéro de téléphone, nom et adresse du restaurant, menu et photos, reçus de paiement.\nClients des restaurants : pour une commande en ligne seulement, prénom, téléphone et adresse de livraison. Consulter un menu ne demande aucune donnée personnelle ; nous comptons les visites de façon anonyme." },
    { id: "usage", title: "2. Pourquoi nous les utilisons", body: "Faire fonctionner le menu, transmettre la commande au restaurant sur WhatsApp, vérifier les numéros (par appel de notre équipe), gérer l'abonnement et l'assistance. Pas de revente, pas de publicité ciblée." },
    { id: "acces", title: "3. Qui y a accès", body: "Le restaurant concerné, notre équipe pour l'assistance, et nos prestataires techniques (hébergement, base de données) dans la limite de leur mission." },
    { id: "duree", title: "4. Combien de temps", body: "Les commandes sont conservées [DURÉE] après leur date, les comptes jusqu'à leur suppression, sauf obligation légale de conservation. Les photos importées pour la lecture automatique du menu sont effacées après 30 jours." },
    { id: "droits", title: "5. Vos droits", body: "Conformément à la loi n° 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel : accès, rectification, opposition et suppression. Écrivez à [EMAIL] ou passez par la page Aide." },
  ],
  ar: [
    { id: "donnees", title: "1. البيانات التي نجمعها", body: "أصحاب المطاعم وفرقهم: الاسم، رقم الهاتف، اسم المطعم وعنوانه، القائمة والصور، وصولات الدفع.\nزبائن المطاعم: عند الطلب عبر الإنترنت فقط، الاسم والهاتف وعنوان التوصيل. تصفح القائمة لا يتطلب أي بيانات شخصية، ونحسب الزيارات دون تحديد الهوية." },
    { id: "usage", title: "2. لماذا نستخدمها", body: "لتشغيل القائمة، إرسال الطلب إلى المطعم عبر واتساب، التحقق من الأرقام (باتصال من فريقنا)، إدارة الاشتراك والمساعدة. لا بيع للبيانات ولا إشهار موجّه." },
    { id: "acces", title: "3. من يطّلع عليها", body: "المطعم المعني، فريقنا للمساعدة، ومزوّدونا التقنيون (الاستضافة، قاعدة البيانات) في حدود مهمتهم." },
    { id: "duree", title: "4. مدة الاحتفاظ", body: "تُحفظ الطلبات [المدة] بعد تاريخها، والحسابات حتى حذفها، إلا إذا فرض القانون غير ذلك. الصور المستوردة لقراءة القائمة آليًا تُحذف بعد 30 يومًا." },
    { id: "droits", title: "5. حقوقك", body: "طبقًا للقانون رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي: حق الاطلاع والتصحيح والاعتراض والحذف. راسلنا على [EMAIL] أو عبر صفحة المساعدة." },
  ],
};

const TERMS: Record<Locale, LegalSection[]> = {
  fr: [
    { id: "service", title: "1. Le service", body: "[RAISON SOCIALE], [ADRESSE], édite Liinky : menus QR, lien de commande WhatsApp, appels de table et outils de gestion pour les restaurants et cafés en Algérie." },
    { id: "compte", title: "2. Compte et essai", body: "L'inscription se fait avec un numéro de téléphone. L'essai gratuit dure le nombre de jours affiché sur la page Tarifs, sans engagement ni carte bancaire." },
    { id: "abonnement", title: "3. Abonnement et paiement", body: "L'abonnement est mensuel, semestriel ou annuel, payé hors ligne (BaridiMob, CCP, espèces, ou à la livraison du kit). Il est activé après vérification du reçu. Sans renouvellement, le menu reste visible pendant une période de grâce, puis passe en lecture seule." },
    { id: "contenu", title: "4. Votre contenu", body: "Vous restez propriétaire de votre menu, de vos photos et de votre logo, et garantissez avoir le droit de les publier. Les prix et la disponibilité affichés relèvent de votre responsabilité. Les commandes sont conclues directement entre vous et vos clients." },
    { id: "usage", title: "5. Usage acceptable", body: "Pas de contenu illégal, trompeur ou portant atteinte aux droits d'autrui. Nous pouvons suspendre un compte qui enfreint ces règles, après avoir tenté de vous contacter." },
    { id: "fin", title: "6. Résiliation", body: "Vous pouvez arrêter à tout moment en ne renouvelant pas. Sur demande, nous supprimons votre restaurant et ses données, sauf obligation légale de conservation." },
    { id: "droit", title: "7. Droit applicable", body: "Les présentes conditions sont soumises au droit algérien. Contact : [EMAIL]." },
  ],
  ar: [
    { id: "service", title: "1. الخدمة", body: "تنشر [الاسم التجاري]، [العنوان]، خدمة Liinky: قوائم QR، رابط الطلب عبر واتساب، استدعاء النادل وأدوات التسيير للمطاعم والمقاهي في الجزائر." },
    { id: "compte", title: "2. الحساب والتجربة", body: "يتم التسجيل برقم الهاتف. تدوم التجربة المجانية عدد الأيام المعروض في صفحة الأسعار، دون التزام ودون بطاقة بنكية." },
    { id: "abonnement", title: "3. الاشتراك والدفع", body: "الاشتراك شهري أو نصف سنوي أو سنوي، يُدفع دون إنترنت (بريدي موب، CCP، نقدًا، أو عند استلام الطقم)، ويُفعَّل بعد التحقق من الوصل. دون تجديد، تبقى القائمة ظاهرة خلال فترة سماح ثم تصبح للقراءة فقط." },
    { id: "contenu", title: "4. محتواك", body: "تبقى مالكًا لقائمتك وصورك وشعارك، وتضمن حقك في نشرها. الأسعار والتوفر المعروضان من مسؤوليتك. تُبرم الطلبات مباشرة بينك وبين زبائنك." },
    { id: "usage", title: "5. الاستخدام المقبول", body: "يُمنع المحتوى غير القانوني أو المضلل أو الماس بحقوق الغير. يمكننا تعليق حساب يخالف هذه القواعد بعد محاولة التواصل معك." },
    { id: "fin", title: "6. الإنهاء", body: "يمكنك التوقف في أي وقت بعدم التجديد. عند الطلب، نحذف مطعمك وبياناته إلا ما يفرض القانون الاحتفاظ به." },
    { id: "droit", title: "7. القانون المطبق", body: "تخضع هذه الشروط للقانون الجزائري. للتواصل: [EMAIL]." },
  ],
};

export function legalSections(kind: "terms" | "privacy", locale: Locale): LegalSection[] {
  return (kind === "terms" ? TERMS : PRIVACY)[locale];
}
