export const PRICING_RULES = {
  staticPageDefault: 250,
  dynamicPageDefault: 500,
  auth: {
    none: 0,
    basic: 1000,
    premium: 2000
  },
  paymentIntegration: 1200
};

export const EXTRA_FEATURES = {
  adminPanel: { id: 'adminPanel', label: 'Admin Panel', price: 1800 },
  cms: { id: 'cms', label: 'CMS / Blog', price: 1500 },
  seo: { id: 'seo', label: 'SEO Setup', price: 800 },
  animations: { id: 'animations', label: 'Animations / Effects', price: 2000 },
  dashboard: { id: 'dashboard', label: 'User Dashboard', price: 6000 },
  emails: { id: 'emails', label: 'Email Notifications', price: 700 },
  chat: { id: 'chat', label: 'Live Chat', price: 2000 },
  analytics: { id: 'analytics', label: 'Analytics Integration', price: 900 },
  multilingual: { id: 'multilingual', label: 'Multi-language', price: 1500 },
  darkMode: { id: 'darkMode', label: 'Dark Mode', price: 600 },
  premiumUi: { id: 'premiumUi', label: 'Premium UI System', price: 4300 },
  enterpriseIntegrations: { id: 'enterpriseIntegrations', label: 'Enterprise Integrations', price: 11800 }
};

export const DELIVERY_OPTIONS = {
  normal: { label: 'Standard', extra: 0 },
  fast: { label: '2x Faster', extra: 1500 },
  urgent: { label: '3x Urgent', extra: 3000 }
};

export const calculateOrderPricing = ({
  siteKind = 'static',
  pages = 1,
  authTier = 'none',
  paymentIntegration = false,
  featureIds = [],
  deliveryOption = 'normal'
} = {}) => {
  const normalizedPages = Math.max(1, Number(pages) || 1);
  const pageRate = siteKind === 'dynamic' ? PRICING_RULES.dynamicPageDefault : PRICING_RULES.staticPageDefault;
  const pagesCost = normalizedPages * pageRate;
  const authCost = PRICING_RULES.auth[authTier] ?? 0;
  const paymentCost = paymentIntegration ? PRICING_RULES.paymentIntegration : 0;
  const featuresCost = featureIds.reduce((sum, id) => sum + (EXTRA_FEATURES[id]?.price || 0), 0);
  const deliveryCost = DELIVERY_OPTIONS[deliveryOption]?.extra || 0;

  const breakdown = [
    { key: 'pages', label: `${normalizedPages} ${siteKind} page${normalizedPages === 1 ? '' : 's'}`, amount: pagesCost },
    ...(authCost ? [{ key: 'auth', label: authTier === 'premium' ? 'Premium Auth System' : 'Basic Login System', amount: authCost }] : []),
    ...(paymentCost ? [{ key: 'payment', label: 'Payment Integration', amount: paymentCost }] : []),
    ...featureIds
      .map((id) => EXTRA_FEATURES[id])
      .filter(Boolean)
      .map((feature) => ({ key: feature.id, label: feature.label, amount: feature.price })),
    ...(deliveryCost ? [{ key: 'delivery', label: `Delivery Upgrade (${deliveryOption})`, amount: deliveryCost }] : [])
  ];

  return {
    pageRate,
    total: breakdown.reduce((sum, item) => sum + item.amount, 0),
    breakdown,
    selectedFeatures: featureIds.map((id) => EXTRA_FEATURES[id]).filter(Boolean)
  };
};
