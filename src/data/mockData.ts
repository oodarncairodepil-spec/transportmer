// Indonesian-style names and locations

export interface Truck {
  id: string;
  plateNumber: string;
  type: 'Trailer' | 'Box Truck' | 'Tanker' | 'Flatbed' | 'Refrigerated';
  capacity: string;
  status: 'Active' | 'In Maintenance' | 'Idle';
  assignedDrivers: string[];
  mileage: number;
  fuelLevel: number;
  lastService: string;
  nextService: string;
  lat: number;
  lng: number;
  location: string;
}

export interface Driver {
  id: string;
  name: string;
  licenseType: string;
  status: 'Available' | 'Assigned' | 'Off-duty';
  phone: string;
  rating: number;
  totalTrips: number;
  assignedTruck: string | null;
  avatar: string;
}

export interface Route {
  id: string;
  truckId: string;
  driverId: string;
  origin: string;
  destination: string;
  status: 'Completed' | 'In Progress' | 'Delayed' | 'Planned';
  plannedDistance: number;
  actualDistance: number;
  startTime: string;
  endTime: string | null;
  deviation: boolean;
  stops: RouteStop[];
}

export interface RouteStop {
  location: string;
  status: 'Completed' | 'Current' | 'Pending';
  arrivedAt: string | null;
  departedAt: string | null;
}

export interface WorkOrder {
  id: string;
  title: string;
  driverId: string;
  truckId: string;
  pickupLocation: string;
  destinations: string[];
  cargoType: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  createdAt: string;
  dueDate: string;
}

export interface MaintenanceRecord {
  id: string;
  truckId: string;
  type: 'Oil Change' | 'Tire Rotation' | 'Brake Inspection' | 'Engine Check' | 'Full Service';
  status: 'Completed' | 'Scheduled' | 'Overdue';
  date: string;
  notes: string;
  cost: number;
}

export interface Alert {
  id: string;
  type: 'deviation' | 'maintenance' | 'stop' | 'compliance' | 'fuel';
  severity: 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  truckId: string;
}

export const trucks: Truck[] = [
  { id: 'TRK-001', plateNumber: 'B 1234 ABC', type: 'Trailer', capacity: '20 ton', status: 'Active', assignedDrivers: ['DRV-001'], mileage: 125000, fuelLevel: 72, lastService: '2026-02-15', nextService: '2026-04-15', lat: -6.2088, lng: 106.8456, location: 'Jakarta Utara' },
  { id: 'TRK-002', plateNumber: 'B 5678 DEF', type: 'Box Truck', capacity: '8 ton', status: 'Active', assignedDrivers: ['DRV-002'], mileage: 89000, fuelLevel: 45, lastService: '2026-01-20', nextService: '2026-03-20', lat: -6.9175, lng: 107.6191, location: 'Bandung' },
  { id: 'TRK-003', plateNumber: 'B 9012 GHI', type: 'Tanker', capacity: '15000 L', status: 'In Maintenance', assignedDrivers: [], mileage: 200000, fuelLevel: 30, lastService: '2026-03-28', nextService: '2026-05-28', lat: -6.2088, lng: 106.8456, location: 'Workshop Jakarta' },
  { id: 'TRK-004', plateNumber: 'D 3456 JKL', type: 'Refrigerated', capacity: '10 ton', status: 'Active', assignedDrivers: ['DRV-004'], mileage: 67000, fuelLevel: 88, lastService: '2026-03-01', nextService: '2026-05-01', lat: -7.2575, lng: 112.7521, location: 'Surabaya' },
  { id: 'TRK-005', plateNumber: 'D 7890 MNO', type: 'Flatbed', capacity: '25 ton', status: 'Idle', assignedDrivers: [], mileage: 156000, fuelLevel: 60, lastService: '2026-02-10', nextService: '2026-04-10', lat: -6.9667, lng: 110.4196, location: 'Semarang' },
  { id: 'TRK-006', plateNumber: 'H 1122 PQR', type: 'Trailer', capacity: '22 ton', status: 'Active', assignedDrivers: ['DRV-006'], mileage: 310000, fuelLevel: 55, lastService: '2026-03-10', nextService: '2026-05-10', lat: -8.6500, lng: 115.2167, location: 'Denpasar' },
  { id: 'TRK-007', plateNumber: 'H 3344 STU', type: 'Box Truck', capacity: '6 ton', status: 'Active', assignedDrivers: ['DRV-007'], mileage: 45000, fuelLevel: 92, lastService: '2026-03-20', nextService: '2026-05-20', lat: -5.1477, lng: 119.4327, location: 'Makassar' },
  { id: 'TRK-008', plateNumber: 'L 5566 VWX', type: 'Tanker', capacity: '12000 L', status: 'Active', assignedDrivers: ['DRV-008'], mileage: 178000, fuelLevel: 38, lastService: '2026-01-05', nextService: '2026-03-05', lat: -7.7956, lng: 110.3695, location: 'Yogyakarta' },
  { id: 'TRK-009', plateNumber: 'L 7788 YZA', type: 'Refrigerated', capacity: '12 ton', status: 'In Maintenance', assignedDrivers: [], mileage: 92000, fuelLevel: 15, lastService: '2026-03-25', nextService: '2026-05-25', lat: -6.2088, lng: 106.8456, location: 'Workshop Jakarta' },
  { id: 'TRK-010', plateNumber: 'F 9900 BCD', type: 'Trailer', capacity: '18 ton', status: 'Active', assignedDrivers: ['DRV-010'], mileage: 234000, fuelLevel: 67, lastService: '2026-02-28', nextService: '2026-04-28', lat: -3.6953, lng: 128.1814, location: 'Ambon' },
];

export const drivers: Driver[] = [
  { id: 'DRV-001', name: 'Budi Santoso', licenseType: 'SIM B2', status: 'Assigned', phone: '+62 812-1234-5678', rating: 4.8, totalTrips: 342, assignedTruck: 'TRK-001', avatar: 'BS' },
  { id: 'DRV-002', name: 'Agus Wibowo', licenseType: 'SIM B2', status: 'Assigned', phone: '+62 813-2345-6789', rating: 4.5, totalTrips: 256, assignedTruck: 'TRK-002', avatar: 'AW' },
  { id: 'DRV-003', name: 'Siti Rahayu', licenseType: 'SIM B1', status: 'Available', phone: '+62 857-3456-7890', rating: 4.9, totalTrips: 189, assignedTruck: null, avatar: 'SR' },
  { id: 'DRV-004', name: 'Eko Prasetyo', licenseType: 'SIM B2', status: 'Assigned', phone: '+62 821-4567-8901', rating: 4.3, totalTrips: 412, assignedTruck: 'TRK-004', avatar: 'EP' },
  { id: 'DRV-005', name: 'Dewi Lestari', licenseType: 'SIM B1', status: 'Off-duty', phone: '+62 878-5678-9012', rating: 4.7, totalTrips: 167, assignedTruck: null, avatar: 'DL' },
  { id: 'DRV-006', name: 'Hendra Gunawan', licenseType: 'SIM B2', status: 'Assigned', phone: '+62 815-6789-0123', rating: 4.6, totalTrips: 523, assignedTruck: 'TRK-006', avatar: 'HG' },
  { id: 'DRV-007', name: 'Rizki Firmansyah', licenseType: 'SIM B2', status: 'Assigned', phone: '+62 838-7890-1234', rating: 4.4, totalTrips: 98, assignedTruck: 'TRK-007', avatar: 'RF' },
  { id: 'DRV-008', name: 'Wahyu Nugroho', licenseType: 'SIM B2', status: 'Assigned', phone: '+62 852-8901-2345', rating: 4.1, totalTrips: 287, assignedTruck: 'TRK-008', avatar: 'WN' },
  { id: 'DRV-009', name: 'Putri Handayani', licenseType: 'SIM B1', status: 'Available', phone: '+62 896-9012-3456', rating: 4.8, totalTrips: 145, assignedTruck: null, avatar: 'PH' },
  { id: 'DRV-010', name: 'Dimas Prabowo', licenseType: 'SIM B2', status: 'Assigned', phone: '+62 811-0123-4567', rating: 4.2, totalTrips: 376, assignedTruck: 'TRK-010', avatar: 'DP' },
  { id: 'DRV-011', name: 'Rina Susanti', licenseType: 'SIM B1', status: 'Available', phone: '+62 819-1234-5678', rating: 4.6, totalTrips: 203, assignedTruck: null, avatar: 'RS' },
  { id: 'DRV-012', name: 'Arief Hidayat', licenseType: 'SIM B2', status: 'Off-duty', phone: '+62 822-2345-6789', rating: 4.0, totalTrips: 445, assignedTruck: null, avatar: 'AH' },
  { id: 'DRV-013', name: 'Yuni Kartika', licenseType: 'SIM B1', status: 'Available', phone: '+62 856-3456-7890', rating: 4.9, totalTrips: 78, assignedTruck: null, avatar: 'YK' },
  { id: 'DRV-014', name: 'Fajar Setiawan', licenseType: 'SIM B2', status: 'Off-duty', phone: '+62 831-4567-8901', rating: 4.3, totalTrips: 312, assignedTruck: null, avatar: 'FS' },
  { id: 'DRV-015', name: 'Mega Puspita', licenseType: 'SIM B2', status: 'Available', phone: '+62 895-5678-9012', rating: 4.7, totalTrips: 156, assignedTruck: null, avatar: 'MP' },
];

export const routes: Route[] = [
  { id: 'RT-001', truckId: 'TRK-001', driverId: 'DRV-001', origin: 'Jakarta', destination: 'Surabaya', status: 'In Progress', plannedDistance: 780, actualDistance: 795, startTime: '2026-03-30T06:00:00', endTime: null, deviation: true, stops: [{ location: 'Gudang Jakarta Utara', status: 'Completed', arrivedAt: '2026-03-30T06:00:00', departedAt: '2026-03-30T06:30:00' }, { location: 'Cirebon Rest Area', status: 'Completed', arrivedAt: '2026-03-30T09:15:00', departedAt: '2026-03-30T09:45:00' }, { location: 'Semarang Depot', status: 'Current', arrivedAt: '2026-03-30T13:00:00', departedAt: null }, { location: 'Gudang Surabaya', status: 'Pending', arrivedAt: null, departedAt: null }] },
  { id: 'RT-002', truckId: 'TRK-002', driverId: 'DRV-002', origin: 'Bandung', destination: 'Jakarta', status: 'Completed', plannedDistance: 150, actualDistance: 148, startTime: '2026-03-29T08:00:00', endTime: '2026-03-29T12:30:00', deviation: false, stops: [{ location: 'Gudang Bandung', status: 'Completed', arrivedAt: '2026-03-29T08:00:00', departedAt: '2026-03-29T08:20:00' }, { location: 'Gudang Jakarta', status: 'Completed', arrivedAt: '2026-03-29T12:30:00', departedAt: '2026-03-29T13:00:00' }] },
  { id: 'RT-003', truckId: 'TRK-004', driverId: 'DRV-004', origin: 'Surabaya', destination: 'Denpasar', status: 'In Progress', plannedDistance: 390, actualDistance: 200, startTime: '2026-03-30T05:00:00', endTime: null, deviation: false, stops: [{ location: 'Gudang Surabaya', status: 'Completed', arrivedAt: '2026-03-30T05:00:00', departedAt: '2026-03-30T05:30:00' }, { location: 'Pelabuhan Ketapang', status: 'Current', arrivedAt: null, departedAt: null }, { location: 'Gudang Denpasar', status: 'Pending', arrivedAt: null, departedAt: null }] },
  { id: 'RT-004', truckId: 'TRK-006', driverId: 'DRV-006', origin: 'Denpasar', destination: 'Makassar', status: 'Delayed', plannedDistance: 850, actualDistance: 120, startTime: '2026-03-29T22:00:00', endTime: null, deviation: true, stops: [{ location: 'Gudang Denpasar', status: 'Completed', arrivedAt: '2026-03-29T22:00:00', departedAt: '2026-03-29T22:30:00' }, { location: 'Pelabuhan Benoa', status: 'Current', arrivedAt: '2026-03-30T00:30:00', departedAt: null }, { location: 'Gudang Makassar', status: 'Pending', arrivedAt: null, departedAt: null }] },
  { id: 'RT-005', truckId: 'TRK-007', driverId: 'DRV-007', origin: 'Makassar', destination: 'Manado', status: 'Planned', plannedDistance: 1500, actualDistance: 0, startTime: '2026-03-31T06:00:00', endTime: null, deviation: false, stops: [{ location: 'Gudang Makassar', status: 'Pending', arrivedAt: null, departedAt: null }, { location: 'Gudang Manado', status: 'Pending', arrivedAt: null, departedAt: null }] },
  { id: 'RT-006', truckId: 'TRK-008', driverId: 'DRV-008', origin: 'Yogyakarta', destination: 'Solo', status: 'Completed', plannedDistance: 65, actualDistance: 65, startTime: '2026-03-28T07:00:00', endTime: '2026-03-28T09:00:00', deviation: false, stops: [{ location: 'Depot Yogyakarta', status: 'Completed', arrivedAt: '2026-03-28T07:00:00', departedAt: '2026-03-28T07:15:00' }, { location: 'Gudang Solo', status: 'Completed', arrivedAt: '2026-03-28T09:00:00', departedAt: '2026-03-28T09:30:00' }] },
  { id: 'RT-007', truckId: 'TRK-010', driverId: 'DRV-010', origin: 'Ambon', destination: 'Sorong', status: 'In Progress', plannedDistance: 1200, actualDistance: 450, startTime: '2026-03-29T04:00:00', endTime: null, deviation: false, stops: [{ location: 'Pelabuhan Ambon', status: 'Completed', arrivedAt: '2026-03-29T04:00:00', departedAt: '2026-03-29T04:30:00' }, { location: 'Pelabuhan Sorong', status: 'Pending', arrivedAt: null, departedAt: null }] },
  { id: 'RT-008', truckId: 'TRK-001', driverId: 'DRV-001', origin: 'Jakarta', destination: 'Bandung', status: 'Completed', plannedDistance: 150, actualDistance: 155, startTime: '2026-03-27T10:00:00', endTime: '2026-03-27T14:30:00', deviation: true, stops: [{ location: 'Gudang Jakarta', status: 'Completed', arrivedAt: '2026-03-27T10:00:00', departedAt: '2026-03-27T10:20:00' }, { location: 'Gudang Bandung', status: 'Completed', arrivedAt: '2026-03-27T14:30:00', departedAt: '2026-03-27T15:00:00' }] },
  { id: 'RT-009', truckId: 'TRK-002', driverId: 'DRV-002', origin: 'Jakarta', destination: 'Semarang', status: 'Completed', plannedDistance: 450, actualDistance: 448, startTime: '2026-03-26T06:00:00', endTime: '2026-03-26T16:00:00', deviation: false, stops: [{ location: 'Gudang Jakarta', status: 'Completed', arrivedAt: '2026-03-26T06:00:00', departedAt: '2026-03-26T06:30:00' }, { location: 'Gudang Semarang', status: 'Completed', arrivedAt: '2026-03-26T16:00:00', departedAt: '2026-03-26T16:30:00' }] },
  { id: 'RT-010', truckId: 'TRK-004', driverId: 'DRV-004', origin: 'Surabaya', destination: 'Malang', status: 'Completed', plannedDistance: 95, actualDistance: 95, startTime: '2026-03-25T08:00:00', endTime: '2026-03-25T10:30:00', deviation: false, stops: [{ location: 'Gudang Surabaya', status: 'Completed', arrivedAt: '2026-03-25T08:00:00', departedAt: '2026-03-25T08:15:00' }, { location: 'Gudang Malang', status: 'Completed', arrivedAt: '2026-03-25T10:30:00', departedAt: '2026-03-25T11:00:00' }] },
  { id: 'RT-011', truckId: 'TRK-006', driverId: 'DRV-006', origin: 'Jakarta', destination: 'Cirebon', status: 'Completed', plannedDistance: 260, actualDistance: 262, startTime: '2026-03-24T07:00:00', endTime: '2026-03-24T12:00:00', deviation: false, stops: [] },
  { id: 'RT-012', truckId: 'TRK-007', driverId: 'DRV-007', origin: 'Makassar', destination: 'Pare-Pare', status: 'Completed', plannedDistance: 155, actualDistance: 160, startTime: '2026-03-23T09:00:00', endTime: '2026-03-23T13:00:00', deviation: true, stops: [] },
  { id: 'RT-013', truckId: 'TRK-008', driverId: 'DRV-008', origin: 'Yogyakarta', destination: 'Semarang', status: 'Completed', plannedDistance: 130, actualDistance: 128, startTime: '2026-03-22T11:00:00', endTime: '2026-03-22T14:00:00', deviation: false, stops: [] },
  { id: 'RT-014', truckId: 'TRK-010', driverId: 'DRV-010', origin: 'Ambon', destination: 'Ternate', status: 'Completed', plannedDistance: 600, actualDistance: 605, startTime: '2026-03-21T05:00:00', endTime: '2026-03-22T08:00:00', deviation: false, stops: [] },
  { id: 'RT-015', truckId: 'TRK-001', driverId: 'DRV-001', origin: 'Jakarta', destination: 'Cirebon', status: 'Completed', plannedDistance: 260, actualDistance: 265, startTime: '2026-03-20T06:00:00', endTime: '2026-03-20T11:00:00', deviation: true, stops: [] },
  { id: 'RT-016', truckId: 'TRK-002', driverId: 'DRV-002', origin: 'Bandung', destination: 'Tasikmalaya', status: 'Completed', plannedDistance: 110, actualDistance: 112, startTime: '2026-03-19T08:00:00', endTime: '2026-03-19T11:00:00', deviation: false, stops: [] },
  { id: 'RT-017', truckId: 'TRK-004', driverId: 'DRV-004', origin: 'Surabaya', destination: 'Semarang', status: 'Completed', plannedDistance: 350, actualDistance: 352, startTime: '2026-03-18T06:00:00', endTime: '2026-03-18T14:00:00', deviation: false, stops: [] },
  { id: 'RT-018', truckId: 'TRK-006', driverId: 'DRV-006', origin: 'Denpasar', destination: 'Surabaya', status: 'Completed', plannedDistance: 390, actualDistance: 395, startTime: '2026-03-17T05:00:00', endTime: '2026-03-17T15:00:00', deviation: true, stops: [] },
  { id: 'RT-019', truckId: 'TRK-007', driverId: 'DRV-007', origin: 'Makassar', destination: 'Kendari', status: 'Completed', plannedDistance: 400, actualDistance: 398, startTime: '2026-03-16T07:00:00', endTime: '2026-03-16T17:00:00', deviation: false, stops: [] },
  { id: 'RT-020', truckId: 'TRK-008', driverId: 'DRV-008', origin: 'Solo', destination: 'Yogyakarta', status: 'Completed', plannedDistance: 65, actualDistance: 65, startTime: '2026-03-15T09:00:00', endTime: '2026-03-15T11:00:00', deviation: false, stops: [] },
];

export const workOrders: WorkOrder[] = [
  { id: 'WO-001', title: 'Pengiriman Bahan Baku ke Pabrik', driverId: 'DRV-001', truckId: 'TRK-001', pickupLocation: 'Gudang Jakarta Utara', destinations: ['Pabrik Surabaya'], cargoType: 'Raw Materials', priority: 'High', status: 'In Progress', createdAt: '2026-03-29', dueDate: '2026-03-31' },
  { id: 'WO-002', title: 'Distribusi Produk Retail', driverId: 'DRV-002', truckId: 'TRK-002', pickupLocation: 'Gudang Bandung', destinations: ['Toko A Jakarta', 'Toko B Bogor'], cargoType: 'Consumer Goods', priority: 'Medium', status: 'Completed', createdAt: '2026-03-28', dueDate: '2026-03-29' },
  { id: 'WO-003', title: 'Pengiriman Bahan Bakar', driverId: 'DRV-008', truckId: 'TRK-008', pickupLocation: 'Depot BBM Yogyakarta', destinations: ['SPBU Magelang', 'SPBU Purworejo'], cargoType: 'Fuel', priority: 'High', status: 'In Progress', createdAt: '2026-03-29', dueDate: '2026-03-30' },
  { id: 'WO-004', title: 'Kiriman Seafood Segar', driverId: 'DRV-004', truckId: 'TRK-004', pickupLocation: 'Pelabuhan Surabaya', destinations: ['Pasar Ikan Denpasar'], cargoType: 'Perishable Goods', priority: 'High', status: 'In Progress', createdAt: '2026-03-30', dueDate: '2026-03-30' },
  { id: 'WO-005', title: 'Pengiriman Alat Berat', driverId: 'DRV-006', truckId: 'TRK-006', pickupLocation: 'Gudang Denpasar', destinations: ['Proyek Konstruksi Makassar'], cargoType: 'Heavy Equipment', priority: 'Medium', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-04-02' },
  { id: 'WO-006', title: 'Distribusi Obat-obatan', driverId: 'DRV-007', truckId: 'TRK-007', pickupLocation: 'Gudang Farmasi Makassar', destinations: ['RS Manado', 'Klinik Gorontalo'], cargoType: 'Pharmaceuticals', priority: 'High', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-04-01' },
  { id: 'WO-007', title: 'Kiriman Elektronik', driverId: 'DRV-010', truckId: 'TRK-010', pickupLocation: 'Gudang Ambon', destinations: ['Toko Elektronik Sorong'], cargoType: 'Electronics', priority: 'Medium', status: 'In Progress', createdAt: '2026-03-28', dueDate: '2026-03-31' },
  { id: 'WO-008', title: 'Pengiriman Semen', driverId: 'DRV-003', truckId: 'TRK-005', pickupLocation: 'Pabrik Semen Semarang', destinations: ['Proyek Tol Jakarta'], cargoType: 'Construction Materials', priority: 'Low', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-04-03' },
  { id: 'WO-009', title: 'Return Barang Rusak', driverId: 'DRV-009', truckId: 'TRK-002', pickupLocation: 'Toko C Depok', destinations: ['Gudang Return Jakarta'], cargoType: 'Returns', priority: 'Low', status: 'Pending', createdAt: '2026-03-29', dueDate: '2026-04-01' },
  { id: 'WO-010', title: 'Pengiriman Tekstil', driverId: 'DRV-011', truckId: 'TRK-005', pickupLocation: 'Pabrik Tekstil Solo', destinations: ['Gudang Semarang', 'Gudang Jakarta'], cargoType: 'Textiles', priority: 'Medium', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-04-02' },
  { id: 'WO-011', title: 'Distribusi Air Mineral', driverId: 'DRV-001', truckId: 'TRK-001', pickupLocation: 'Pabrik Air Bogor', destinations: ['Minimarket Jakarta (15 titik)'], cargoType: 'Beverages', priority: 'Medium', status: 'Completed', createdAt: '2026-03-26', dueDate: '2026-03-27' },
  { id: 'WO-012', title: 'Kiriman Furniture', driverId: 'DRV-002', truckId: 'TRK-002', pickupLocation: 'Pabrik Furniture Jepara', destinations: ['Showroom Jakarta'], cargoType: 'Furniture', priority: 'Low', status: 'Completed', createdAt: '2026-03-24', dueDate: '2026-03-26' },
  { id: 'WO-013', title: 'Emergency Medical Supply', driverId: 'DRV-004', truckId: 'TRK-004', pickupLocation: 'Gudang PMI Surabaya', destinations: ['RS Bali', 'RS Lombok'], cargoType: 'Medical Supplies', priority: 'High', status: 'Completed', createdAt: '2026-03-22', dueDate: '2026-03-23' },
  { id: 'WO-014', title: 'Pengiriman Pupuk', driverId: 'DRV-006', truckId: 'TRK-006', pickupLocation: 'Pabrik Pupuk Gresik', destinations: ['Koperasi Tani Bali'], cargoType: 'Fertilizer', priority: 'Medium', status: 'Completed', createdAt: '2026-03-20', dueDate: '2026-03-22' },
  { id: 'WO-015', title: 'Distribusi Beras', driverId: 'DRV-008', truckId: 'TRK-008', pickupLocation: 'Gudang Bulog Yogya', destinations: ['Pasar Semarang', 'Pasar Solo'], cargoType: 'Rice', priority: 'High', status: 'Completed', createdAt: '2026-03-18', dueDate: '2026-03-19' },
  { id: 'WO-016', title: 'Pengiriman Spare Parts', driverId: 'DRV-007', truckId: 'TRK-007', pickupLocation: 'Gudang Parts Makassar', destinations: ['Bengkel Pare-Pare'], cargoType: 'Auto Parts', priority: 'Low', status: 'Completed', createdAt: '2026-03-17', dueDate: '2026-03-18' },
  { id: 'WO-017', title: 'Kiriman Buku Pelajaran', driverId: 'DRV-010', truckId: 'TRK-010', pickupLocation: 'Percetakan Ambon', destinations: ['Sekolah Ternate', 'Sekolah Halmahera'], cargoType: 'Books', priority: 'Medium', status: 'Completed', createdAt: '2026-03-15', dueDate: '2026-03-17' },
  { id: 'WO-018', title: 'Pengiriman Paket E-Commerce', driverId: 'DRV-003', truckId: 'TRK-005', pickupLocation: 'Warehouse Tokped Semarang', destinations: ['Hub Jakarta', 'Hub Bandung'], cargoType: 'Parcels', priority: 'High', status: 'Cancelled', createdAt: '2026-03-25', dueDate: '2026-03-26' },
  { id: 'WO-019', title: 'Kiriman Sayur Segar', driverId: 'DRV-004', truckId: 'TRK-004', pickupLocation: 'Pasar Induk Surabaya', destinations: ['Supermarket Malang (5 cabang)'], cargoType: 'Fresh Vegetables', priority: 'High', status: 'Completed', createdAt: '2026-03-14', dueDate: '2026-03-14' },
  { id: 'WO-020', title: 'Pengiriman Oli Industri', driverId: 'DRV-008', truckId: 'TRK-008', pickupLocation: 'Gudang Pertamina Yogya', destinations: ['Pabrik-pabrik Solo'], cargoType: 'Industrial Oil', priority: 'Medium', status: 'Completed', createdAt: '2026-03-13', dueDate: '2026-03-14' },
  { id: 'WO-021', title: 'Kiriman Container Import', driverId: 'DRV-001', truckId: 'TRK-001', pickupLocation: 'Pelabuhan Tanjung Priok', destinations: ['Gudang Cikarang'], cargoType: 'Import Container', priority: 'High', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-04-01' },
  { id: 'WO-022', title: 'Distribusi LPG', driverId: 'DRV-011', truckId: 'TRK-005', pickupLocation: 'Depot LPG Semarang', destinations: ['Agen LPG Kendal', 'Agen LPG Demak'], cargoType: 'LPG', priority: 'High', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-03-31' },
  { id: 'WO-023', title: 'Return Kontainer Kosong', driverId: 'DRV-012', truckId: 'TRK-005', pickupLocation: 'Gudang Cikarang', destinations: ['Pelabuhan Tanjung Priok'], cargoType: 'Empty Container', priority: 'Low', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-04-02' },
  { id: 'WO-024', title: 'Kiriman Alat Pertanian', driverId: 'DRV-013', truckId: 'TRK-005', pickupLocation: 'Gudang Alsintan Semarang', destinations: ['Koperasi Tani Brebes'], cargoType: 'Agricultural Equipment', priority: 'Low', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-04-03' },
  { id: 'WO-025', title: 'Pengiriman Cairan Kimia', driverId: 'DRV-008', truckId: 'TRK-008', pickupLocation: 'Pabrik Kimia Gresik', destinations: ['Pabrik Tekstil Solo'], cargoType: 'Chemicals', priority: 'High', status: 'Pending', createdAt: '2026-03-30', dueDate: '2026-03-31' },
  { id: 'WO-026', title: 'Distribusi Snack', driverId: 'DRV-002', truckId: 'TRK-002', pickupLocation: 'Pabrik Snack Bandung', destinations: ['Agen Cimahi', 'Agen Garut'], cargoType: 'Snacks', priority: 'Low', status: 'Completed', createdAt: '2026-03-12', dueDate: '2026-03-13' },
  { id: 'WO-027', title: 'Kiriman Mesin Pabrik', driverId: 'DRV-006', truckId: 'TRK-006', pickupLocation: 'Pelabuhan Surabaya', destinations: ['Pabrik Denpasar'], cargoType: 'Machinery', priority: 'High', status: 'Completed', createdAt: '2026-03-10', dueDate: '2026-03-12' },
  { id: 'WO-028', title: 'Pengiriman Kertas', driverId: 'DRV-007', truckId: 'TRK-007', pickupLocation: 'Pabrik Kertas Makassar', destinations: ['Percetakan Pare-Pare'], cargoType: 'Paper', priority: 'Low', status: 'Completed', createdAt: '2026-03-09', dueDate: '2026-03-10' },
  { id: 'WO-029', title: 'Express Delivery Dokumen', driverId: 'DRV-010', truckId: 'TRK-010', pickupLocation: 'Kantor Pos Ambon', destinations: ['Kantor Pos Ternate'], cargoType: 'Documents', priority: 'High', status: 'Completed', createdAt: '2026-03-08', dueDate: '2026-03-08' },
  { id: 'WO-030', title: 'Kiriman Peralatan Kantor', driverId: 'DRV-009', truckId: 'TRK-002', pickupLocation: 'Gudang Office Supply Jakarta', destinations: ['Kantor Cabang Bogor', 'Kantor Cabang Depok'], cargoType: 'Office Supplies', priority: 'Low', status: 'Completed', createdAt: '2026-03-07', dueDate: '2026-03-08' },
];

export const maintenanceRecords: MaintenanceRecord[] = [
  { id: 'MNT-001', truckId: 'TRK-001', type: 'Oil Change', status: 'Scheduled', date: '2026-04-15', notes: 'Regular 10,000 km service', cost: 850000 },
  { id: 'MNT-002', truckId: 'TRK-002', type: 'Full Service', status: 'Overdue', date: '2026-03-20', notes: 'Overdue by 10 days', cost: 3500000 },
  { id: 'MNT-003', truckId: 'TRK-003', type: 'Engine Check', status: 'Completed', date: '2026-03-28', notes: 'Engine overhaul in progress', cost: 15000000 },
  { id: 'MNT-004', truckId: 'TRK-004', type: 'Tire Rotation', status: 'Scheduled', date: '2026-04-05', notes: 'Front tires showing wear', cost: 2000000 },
  { id: 'MNT-005', truckId: 'TRK-005', type: 'Brake Inspection', status: 'Scheduled', date: '2026-04-10', notes: 'Annual brake check', cost: 1200000 },
  { id: 'MNT-006', truckId: 'TRK-006', type: 'Oil Change', status: 'Completed', date: '2026-03-10', notes: 'Completed on schedule', cost: 900000 },
  { id: 'MNT-007', truckId: 'TRK-007', type: 'Full Service', status: 'Completed', date: '2026-03-20', notes: '50,000 km full service', cost: 4200000 },
  { id: 'MNT-008', truckId: 'TRK-008', type: 'Engine Check', status: 'Overdue', date: '2026-03-05', notes: 'Overdue - engine running hot', cost: 5000000 },
  { id: 'MNT-009', truckId: 'TRK-009', type: 'Full Service', status: 'Completed', date: '2026-03-25', notes: 'Major repair completed', cost: 18000000 },
  { id: 'MNT-010', truckId: 'TRK-010', type: 'Tire Rotation', status: 'Scheduled', date: '2026-04-20', notes: 'New tires ordered', cost: 8000000 },
];

export const alerts: Alert[] = [
  { id: 'ALT-001', type: 'deviation', severity: 'high', message: 'TRK-001 deviated from planned route near Cirebon', timestamp: '2026-03-30T09:30:00', truckId: 'TRK-001' },
  { id: 'ALT-002', type: 'maintenance', severity: 'high', message: 'TRK-002 overdue for full service by 10 days', timestamp: '2026-03-30T08:00:00', truckId: 'TRK-002' },
  { id: 'ALT-003', type: 'stop', severity: 'medium', message: 'TRK-006 stopped unexpectedly at Pelabuhan Benoa for 2+ hours', timestamp: '2026-03-30T02:45:00', truckId: 'TRK-006' },
  { id: 'ALT-004', type: 'fuel', severity: 'medium', message: 'TRK-008 fuel level critically low (38%)', timestamp: '2026-03-30T10:15:00', truckId: 'TRK-008' },
  { id: 'ALT-005', type: 'compliance', severity: 'high', message: 'TRK-001 entered restricted zone in Central Jakarta', timestamp: '2026-03-30T07:15:00', truckId: 'TRK-001' },
  { id: 'ALT-006', type: 'maintenance', severity: 'high', message: 'TRK-008 engine check overdue - engine running hot', timestamp: '2026-03-30T06:00:00', truckId: 'TRK-008' },
  { id: 'ALT-007', type: 'stop', severity: 'low', message: 'TRK-004 scheduled rest stop at Ketapang', timestamp: '2026-03-30T11:00:00', truckId: 'TRK-004' },
  { id: 'ALT-008', type: 'deviation', severity: 'medium', message: 'TRK-006 minor route deviation near Denpasar port', timestamp: '2026-03-30T00:15:00', truckId: 'TRK-006' },
];

export const fuelHistory = [
  { date: 'Mar 24', consumption: 420, mileage: 2800 },
  { date: 'Mar 25', consumption: 385, mileage: 2500 },
  { date: 'Mar 26', consumption: 510, mileage: 3200 },
  { date: 'Mar 27', consumption: 445, mileage: 2900 },
  { date: 'Mar 28', consumption: 390, mileage: 2600 },
  { date: 'Mar 29', consumption: 475, mileage: 3100 },
  { date: 'Mar 30', consumption: 520, mileage: 3400 },
];

export const scheduleEvents = [
  { id: 'SCH-001', driverId: 'DRV-001', type: 'shift' as const, title: 'Morning Shift', day: 'Mon', start: '06:00', end: '18:00' },
  { id: 'SCH-002', driverId: 'DRV-002', type: 'shift' as const, title: 'Morning Shift', day: 'Mon', start: '07:00', end: '19:00' },
  { id: 'SCH-003', driverId: 'DRV-004', type: 'shift' as const, title: 'Night Shift', day: 'Mon', start: '18:00', end: '06:00' },
  { id: 'SCH-004', driverId: 'DRV-005', type: 'leave' as const, title: 'Annual Leave', day: 'Mon', start: '', end: '' },
  { id: 'SCH-005', driverId: 'DRV-006', type: 'shift' as const, title: 'Morning Shift', day: 'Mon', start: '05:00', end: '17:00' },
  { id: 'SCH-006', driverId: 'DRV-007', type: 'shift' as const, title: 'Afternoon Shift', day: 'Tue', start: '12:00', end: '00:00' },
  { id: 'SCH-007', driverId: 'DRV-008', type: 'shift' as const, title: 'Morning Shift', day: 'Tue', start: '06:00', end: '18:00' },
  { id: 'SCH-008', driverId: 'DRV-010', type: 'shift' as const, title: 'Morning Shift', day: 'Tue', start: '04:00', end: '16:00' },
  { id: 'SCH-009', driverId: 'DRV-001', type: 'shift' as const, title: 'Morning Shift', day: 'Tue', start: '06:00', end: '18:00' },
  { id: 'SCH-010', driverId: 'DRV-012', type: 'leave' as const, title: 'Sick Leave', day: 'Tue', start: '', end: '' },
  { id: 'SCH-011', driverId: 'DRV-001', type: 'shift' as const, title: 'Morning Shift', day: 'Wed', start: '06:00', end: '18:00' },
  { id: 'SCH-012', driverId: 'DRV-002', type: 'shift' as const, title: 'Morning Shift', day: 'Wed', start: '07:00', end: '19:00' },
  { id: 'SCH-013', driverId: 'DRV-004', type: 'shift' as const, title: 'Morning Shift', day: 'Wed', start: '06:00', end: '18:00' },
  { id: 'SCH-014', driverId: 'DRV-014', type: 'leave' as const, title: 'Holiday', day: 'Wed', start: '', end: '' },
  { id: 'SCH-015', driverId: 'DRV-006', type: 'shift' as const, title: 'Night Shift', day: 'Thu', start: '18:00', end: '06:00' },
  { id: 'SCH-016', driverId: 'DRV-007', type: 'shift' as const, title: 'Morning Shift', day: 'Thu', start: '06:00', end: '18:00' },
  { id: 'SCH-017', driverId: 'DRV-008', type: 'shift' as const, title: 'Morning Shift', day: 'Thu', start: '06:00', end: '18:00' },
  { id: 'SCH-018', driverId: 'DRV-010', type: 'shift' as const, title: 'Morning Shift', day: 'Thu', start: '04:00', end: '16:00' },
  { id: 'SCH-019', driverId: 'DRV-001', type: 'shift' as const, title: 'Rest Day', day: 'Fri', start: '', end: '' },
  { id: 'SCH-020', driverId: 'DRV-002', type: 'shift' as const, title: 'Morning Shift', day: 'Fri', start: '07:00', end: '19:00' },
];
