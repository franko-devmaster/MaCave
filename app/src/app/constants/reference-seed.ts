/** Référentiel initial chargé au premier lancement, puis enrichi par les saisies. */
export const SEED_REGIONS: Record<string, readonly string[]> = {
  Suisse: ['Valais', 'Vaud', 'Genève', 'Neuchâtel', 'Fribourg', 'Trois-Lacs', 'Tessin', 'Grisons', 'Suisse alémanique'],
  France: [
    'Alsace', 'Beaujolais', 'Bordeaux', 'Bourgogne', 'Champagne', 'Corse', 'Jura', 'Languedoc-Roussillon',
    'Loire', 'Provence', 'Rhône', 'Savoie', 'Sud-Ouest',
  ],
  Italie: ['Piémont', 'Toscane', 'Vénétie', 'Lombardie', 'Trentin-Haut-Adige', 'Frioul', 'Ombrie', 'Marches', 'Abruzzes', 'Campanie', 'Pouilles', 'Sicile', 'Sardaigne'],
  Espagne: ['Rioja', 'Ribera del Duero', 'Priorat', 'Rías Baixas', 'Rueda', 'Penedès', 'Toro', 'Jerez', 'Bierzo'],
  Portugal: ['Douro', 'Porto', 'Alentejo', 'Dão', 'Vinho Verde', 'Bairrada', 'Madère'],
  Allemagne: ['Moselle', 'Rheingau', 'Palatinat', 'Rheinhessen', 'Nahe', 'Bade', 'Franconie'],
  Autriche: ['Wachau', 'Kamptal', 'Kremstal', 'Burgenland', 'Styrie', 'Weinviertel'],
  Grèce: ['Santorin', 'Naoussa', 'Némée', 'Crète'],
  Hongrie: ['Tokaj', 'Villány', 'Eger'],
  Liban: ['Bekaa'],
  'États-Unis': ['Californie', 'Oregon', 'Washington', 'New York'],
  Argentine: ['Mendoza', 'Salta', 'Patagonie'],
  Chili: ['Maipo', 'Colchagua', 'Casablanca', 'Maule'],
  'Afrique du Sud': ['Stellenbosch', 'Swartland', 'Franschhoek', 'Constantia'],
  Australie: ['Barossa', 'McLaren Vale', 'Hunter Valley', 'Margaret River', 'Yarra Valley', 'Clare Valley'],
  'Nouvelle-Zélande': ['Marlborough', 'Central Otago', "Hawke's Bay"],
};

export const SEED_COUNTRIES: readonly string[] = Object.keys(SEED_REGIONS);

export const SEED_GRAPES: readonly string[] = [
  // Cépages suisses et alpins
  'Amigne', 'Arvine', 'Petite Arvine', 'Chasselas', 'Cornalin', 'Diolinoir', 'Gamaret', 'Garanoir',
  'Humagne Blanche', 'Humagne Rouge', 'Heida', 'Johannisberg', 'Païen', 'Rèze', 'Completer', 'Mondeuse',
  'Altesse', 'Jacquère',
  // Rouges internationaux et régionaux
  'Pinot Noir', 'Gamay', 'Syrah', 'Merlot', 'Cabernet Sauvignon', 'Cabernet Franc', 'Malbec', 'Grenache',
  'Mourvèdre', 'Carignan', 'Cinsault', 'Tannat', 'Petit Verdot', 'Nebbiolo', 'Sangiovese', 'Barbera',
  'Dolcetto', 'Corvina', 'Primitivo', 'Nero d’Avola', 'Aglianico', 'Montepulciano', 'Tempranillo',
  'Touriga Nacional', 'Zinfandel', 'Pinotage', 'Carménère', 'Blaufränkisch', 'Zweigelt', 'Xinomavro',
  'Agiorgitiko', 'Poulsard', 'Trousseau',
  // Blancs internationaux et régionaux
  'Chardonnay', 'Sauvignon Blanc', 'Chenin Blanc', 'Riesling', 'Gewurztraminer', 'Pinot Gris', 'Pinot Blanc',
  'Sylvaner', 'Muscat', 'Viognier', 'Marsanne', 'Roussanne', 'Sémillon', 'Savagnin', 'Aligoté', 'Melon de Bourgogne',
  'Grüner Veltliner', 'Albariño', 'Verdejo', 'Garnacha Blanca', 'Vermentino', 'Garganega', 'Trebbiano',
  'Fiano', 'Greco', 'Assyrtiko', 'Furmint', 'Müller-Thurgau', 'Glera',
];
