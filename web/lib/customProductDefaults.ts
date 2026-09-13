// Default content for the /custom design page. This is used when the tenant
// has not customised the product info yet, and also as the fallback shape.

export const CUSTOM_PRODUCT_DEFAULTS: Record<
  string,
  {
    title: string;
    description: string;
    size_guide_url: string;
    sizes: string[];
    specs: string[];
  }
> = {
  'premium-cotton-7200': {
    title: 'New States Apparel Premium Cotton T-shirt 7200',
    description:
      'Made from lightweight ring-spun cotton, this t-shirt offers a noticeably softer and more comfortable feel. It features a regular fit that sits nicely without feeling tight. A versatile choice for relaxed days or clean, casual looks.',
    size_guide_url: '/assets/size-guide/premium-cotton-7200.webp',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    specs: [
      '100% cotton ring spun preshrunk jersey knit.',
      '50% Cotton, 50% Polyester for Heather colors.',
      '90% Cotton, 10% Polyester for Sport Grey color.',
      '180g/m².',
      'Single needle 2.2 cm collar.',
      'Taped neck and shoulders.',
      'Tubular construction.',
      'Double needle sleeve and bottom hems.',
      'Quarter-turned to eliminate centre crease.',
    ],
  },
};

export function getCustomProductDefault(key: string) {
  return CUSTOM_PRODUCT_DEFAULTS[key] || CUSTOM_PRODUCT_DEFAULTS['premium-cotton-7200'];
}
