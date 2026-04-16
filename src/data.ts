export type Component = {
  name: string;
  baseWeight: number; // weight for 10 inch in grams
};

export type Design = {
  id: string;
  name: string;
  category: string;
  image: string;
  components: Component[];
};

// Placeholder components since specific weights weren't provided for the new designs yet.
// You can edit these later!
const defaultComponents: Component[] = [
  { name: 'Base Chain', baseWeight: 20 },
  { name: 'Kundu + Seal', baseWeight: 1.5 },
  { name: 'Salangai', baseWeight: 2 },
];

const img1 = 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&q=80&w=800';
const img2 = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=800';
const img3 = 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&q=80&w=800';
const img4 = 'https://images.unsplash.com/photo-1599643478524-fb66f70d00ea?auto=format&fit=crop&q=80&w=800';

export const DESIGNS: Design[] = [
  // JALARA Category
  { id: '4-jalara', name: '4 JALARA', category: 'JALARA', image: img1, components: defaultComponents },
  { id: '3-jalara', name: '3 JALARA', category: 'JALARA', image: img2, components: defaultComponents },
  { id: '2-jalara', name: '2 JALARA', category: 'JALARA', image: img3, components: defaultComponents },
  { id: 'muslim-savithri-jalara', name: 'MUSLIM JALARA / SAVITHRI JALARA', category: 'JALARA', image: img4, components: defaultComponents },
  { id: 'm-jalara', name: 'M JALARA', category: 'JALARA', image: img1, components: defaultComponents },
  { id: 'parada-jalara', name: 'PARADA JALARA', category: 'JALARA', image: img2, components: defaultComponents },
  { id: 'fully-cross-jalara', name: 'FULLY CROSS JALARA', category: 'JALARA', image: img3, components: defaultComponents },
  { id: 'double-cross-jalara', name: 'DOUBLE CROSS JALARA', category: 'JALARA', image: img4, components: defaultComponents },
  
  // FLOWERS Category
  { id: 'double-mango', name: 'DOUBLE MANGO', category: 'FLOWERS', image: img1, components: defaultComponents },
  { id: 'mango-flower', name: 'MANGO FLOWER', category: 'FLOWERS', image: img2, components: defaultComponents },
  { id: 'mani-flower', name: 'MANI FLOWER', category: 'FLOWERS', image: img3, components: defaultComponents },
  { id: 'three-rava', name: 'THREE RAVA', category: 'FLOWERS', image: img4, components: defaultComponents },
  
  // GUBBA Category
  { id: 'gubba', name: 'GUBBA', category: 'GUBBA', image: img1, components: defaultComponents },
  { id: 'gubba-valrajam', name: 'GUBBA VALRAJAM', category: 'GUBBA', image: img2, components: defaultComponents },
  
  // RAVA Category
  { id: 'line-rava', name: 'LINE RAVA', category: 'RAVA', image: img3, components: defaultComponents },
  { id: 'one-rava', name: 'ONE RAVA', category: 'RAVA', image: img4, components: defaultComponents },
  { id: 'two-rava', name: 'TWO RAVA', category: 'RAVA', image: img1, components: defaultComponents },
];
