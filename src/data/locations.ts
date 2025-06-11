
export const countries = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", 
  "Austria", "Azerbaijan", "Bahrain", "Bangladesh", "Belarus", "Belgium", 
  "Bolivia", "Bosnia and Herzegovina", "Brazil", "Bulgaria", "Cambodia", 
  "Canada", "Chile", "China", "Colombia", "Croatia", "Czech Republic", 
  "Denmark", "Egypt", "Estonia", "Ethiopia", "Finland", "France", "Georgia", 
  "Germany", "Ghana", "Greece", "Hungary", "Iceland", "India", "Indonesia", 
  "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan", "Kazakhstan", 
  "Kenya", "Kuwait", "Latvia", "Lebanon", "Lithuania", "Luxembourg", "Malaysia", 
  "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria", "Norway", 
  "Pakistan", "Philippines", "Poland", "Portugal", "Qatar", "Romania", 
  "Russia", "Saudi Arabia", "Singapore", "Slovakia", "Slovenia", "South Africa", 
  "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Thailand", 
  "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", 
  "Vietnam"
];

export const citiesByCountry = {
  "United States": [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", 
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville", 
    "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis", 
    "Seattle", "Denver", "Washington", "Boston", "El Paso", "Nashville", "Detroit", 
    "Oklahoma City", "Portland", "Las Vegas", "Memphis", "Louisville", "Baltimore", 
    "Milwaukee", "Albuquerque", "Tucson", "Fresno", "Sacramento", "Kansas City", 
    "Long Beach", "Mesa", "Atlanta", "Colorado Springs", "Virginia Beach", "Raleigh", 
    "Omaha", "Miami", "Oakland", "Minneapolis", "Tulsa", "Wichita", "New Orleans"
  ],
  "United Kingdom": [
    "London", "Birmingham", "Manchester", "Liverpool", "Leeds", "Sheffield", 
    "Bristol", "Newcastle", "Nottingham", "Cardiff", "Edinburgh", "Glasgow"
  ],
  "France": [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", 
    "Montpellier", "Bordeaux", "Lille", "Rennes", "Reims"
  ],
  "Germany": [
    "Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", 
    "Dusseldorf", "Dortmund", "Essen", "Leipzig", "Bremen", "Dresden"
  ],
  "Spain": [
    "Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Malaga", 
    "Murcia", "Palma", "Las Palmas", "Bilbao", "Alicante", "Cordoba"
  ],
  "Italy": [
    "Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", 
    "Florence", "Bari", "Catania", "Venice", "Verona"
  ],
  "India": [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", 
    "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore", 
    "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna", "Vadodara", 
    "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", 
    "Kalyan-Dombivali", "Vasai-Virar", "Varanasi", "Srinagar", "Dhanbad", 
    "Jodhpur", "Amritsar", "Raipur", "Allahabad", "Coimbatore", "Jabalpur", 
    "Gwalior", "Vijayawada", "Madurai", "Guwahati", "Chandigarh", "Hubli-Dharwad"
  ],
  "China": [
    "Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu", "Hangzhou", 
    "Wuhan", "Xi'an", "Nanjing", "Tianjin", "Shenyang", "Harbin"
  ],
  "Japan": [
    "Tokyo", "Osaka", "Kyoto", "Yokohama", "Nagoya", "Sapporo", "Kobe", 
    "Kawasaki", "Hiroshima", "Sendai", "Chiba", "Kitakyushu"
  ],
  "South Korea": [
    "Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", 
    "Ulsan", "Changwon", "Goyang", "Yongin", "Seongnam"
  ],
  "Australia": [
    "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", 
    "Newcastle", "Canberra", "Sunshine Coast", "Wollongong", "Geelong", "Hobart"
  ],
  "Canada": [
    "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", 
    "Winnipeg", "Quebec City", "Hamilton", "Kitchener", "London", "Victoria"
  ],
  "Brazil": [
    "São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", 
    "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Goiânia", "Belém", "Porto Alegre"
  ],
  "Russia": [
    "Moscow", "St. Petersburg", "Novosibirsk", "Yekaterinburg", "Nizhny Novgorod", 
    "Kazan", "Chelyabinsk", "Omsk", "Samara", "Rostov-on-Don", "Ufa", "Krasnoyarsk"
  ],
  "Mexico": [
    "Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", 
    "Juárez", "Torreón", "Querétaro", "San Luis Potosí", "Mérida", "Mexicali"
  ],
  "Argentina": [
    "Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "La Plata", 
    "Mar del Plata", "Salta", "Santa Fe", "San Juan", "Resistencia", "Santiago del Estero"
  ]
};

// For countries not listed above, provide some common cities
export const getDefaultCities = () => [
  "Capital City", "Main City", "Central City", "Metropolitan Area"
];

export const getCitiesForCountry = (country: string): string[] => {
  return citiesByCountry[country as keyof typeof citiesByCountry] || getDefaultCities();
};
