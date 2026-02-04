import DisplayCards from '../DisplayCards';
import { Building2, TrendingUp, Camera } from 'lucide-react';

export default function DisplayCardsExample() {
  const propertyCards = [
    {
      icon: <Building2 className="size-4 text-blue-300" />,
      title: "Nouveaux Biens",
      description: "3 opportunités détectées",
      date: "Il y a 2h",
      titleClassName: "text-blue-400",
    },
    {
      icon: <TrendingUp className="size-4 text-purple-300" />,
      title: "Analyse Marché",
      description: "Prix en hausse de 12%",
      date: "Aujourd'hui",
      titleClassName: "text-purple-400",
    },
    {
      icon: <Camera className="size-4 text-green-300" />,
      title: "Photos Améliorées",
      description: "15 images traitées",
      date: "Il y a 30min",
      titleClassName: "text-green-400",
    },
  ];

  return <DisplayCards cards={propertyCards} />;
}