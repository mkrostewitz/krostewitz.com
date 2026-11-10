import {CarFront, CircuitBoard, Cog, Factory, TrainFront, Warehouse, Megaphone, Bike, Workflow, FerrisWheel, RadioTower} from 'lucide-react';
import {resolveIndustryIcon} from '../lib/industryIcons.mjs';

const icons = {
  factory: Factory, automation: Cog, infrastructure: TrainFront,
  automotive: CarFront, electronics: CircuitBoard, intralogistics: Warehouse,
  advertisement: Megaphone, mobility: Bike, process: Workflow,
  attractions: FerrisWheel, telecommunications: RadioTower,
};

export default function IndustryIcon({industry, ...props}) {
  const Icon = icons[resolveIndustryIcon(industry)];
  return <Icon size={22} strokeWidth={1.75} {...props} aria-hidden="true" />;
}
