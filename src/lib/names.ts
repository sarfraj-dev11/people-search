// Shared name pools + deterministic RNG helpers used by the DB seeder.

export const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph",
  "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa",
  "Daniel", "Nancy", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra",
  "Donald", "Ashley", "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna",
  "Joshua", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Dorothy",
  "Timothy", "Melissa", "Ronald", "Deborah", "Jason", "Stephanie", "Edward",
  "Rebecca", "Jeffrey", "Sharon", "Ryan", "Laura", "Jacob", "Cynthia", "Gary",
  "Kathleen", "Nicholas", "Amy", "Eric", "Angela", "Jonathan", "Shirley",
  "Stephen", "Anna", "Larry", "Brenda", "Justin", "Pamela", "Scott", "Emma",
  "Brandon", "Nicole", "Benjamin", "Helen", "Samuel", "Samantha", "Gregory",
  "Katherine", "Alexander", "Christine", "Patrick", "Debra", "Frank", "Rachel",
  "Raymond", "Carolyn", "Jack", "Janet", "Dennis", "Maria", "Jerry", "Olivia",
];

export const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
  "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera",
  "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans",
  "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart",
  "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz",
  "Morgan", "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos",
  "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood",
];

export const CITIES: { city: string; state: string; zip: string }[] = [
  { city: "Houston", state: "TX", zip: "77002" },
  { city: "Phoenix", state: "AZ", zip: "85001" },
  { city: "Chicago", state: "IL", zip: "60601" },
  { city: "Columbus", state: "OH", zip: "43215" },
  { city: "Charlotte", state: "NC", zip: "28202" },
  { city: "Seattle", state: "WA", zip: "98101" },
  { city: "Denver", state: "CO", zip: "80202" },
  { city: "Miami", state: "FL", zip: "33101" },
  { city: "Atlanta", state: "GA", zip: "30303" },
  { city: "Boston", state: "MA", zip: "02108" },
  { city: "Nashville", state: "TN", zip: "37201" },
  { city: "Portland", state: "OR", zip: "97201" },
  { city: "Las Vegas", state: "NV", zip: "89101" },
  { city: "Minneapolis", state: "MN", zip: "55401" },
  { city: "San Diego", state: "CA", zip: "92101" },
  { city: "Dallas", state: "TX", zip: "75201" },
  { city: "Philadelphia", state: "PA", zip: "19102" },
  { city: "Detroit", state: "MI", zip: "48201" },
  { city: "Indianapolis", state: "IN", zip: "46204" },
  { city: "Jacksonville", state: "FL", zip: "32202" },
  { city: "New York", state: "NY", zip: "10001" },
  { city: "Los Angeles", state: "CA", zip: "90001" },
  { city: "San Francisco", state: "CA", zip: "94102" },
  { city: "Austin", state: "TX", zip: "73301" },
  { city: "Baltimore", state: "MD", zip: "21201" },
  { city: "Milwaukee", state: "WI", zip: "53202" },
  { city: "Albuquerque", state: "NM", zip: "87101" },
  { city: "Tucson", state: "AZ", zip: "85701" },
  { city: "Fresno", state: "CA", zip: "93701" },
  { city: "Sacramento", state: "CA", zip: "95814" },
  { city: "Kansas City", state: "MO", zip: "64101" },
  { city: "Omaha", state: "NE", zip: "68102" },
  { city: "Raleigh", state: "NC", zip: "27601" },
  { city: "Virginia Beach", state: "VA", zip: "23451" },
  { city: "Louisville", state: "KY", zip: "40202" },
  { city: "Oklahoma City", state: "OK", zip: "73102" },
  { city: "Salt Lake City", state: "UT", zip: "84101" },
  { city: "Boise", state: "ID", zip: "83702" },
  { city: "Des Moines", state: "IA", zip: "50309" },
  { city: "Little Rock", state: "AR", zip: "72201" },
  { city: "Birmingham", state: "AL", zip: "35203" },
  { city: "Jackson", state: "MS", zip: "39201" },
  { city: "New Orleans", state: "LA", zip: "70112" },
  { city: "Charleston", state: "SC", zip: "29401" },
  { city: "Providence", state: "RI", zip: "02903" },
  { city: "Hartford", state: "CT", zip: "06103" },
  { city: "Newark", state: "NJ", zip: "07102" },
  { city: "Wilmington", state: "DE", zip: "19801" },
  { city: "Fargo", state: "ND", zip: "58102" },
  { city: "Sioux Falls", state: "SD", zip: "57104" },
  { city: "Billings", state: "MT", zip: "59101" },
  { city: "Cheyenne", state: "WY", zip: "82001" },
  { city: "Anchorage", state: "AK", zip: "99501" },
  { city: "Honolulu", state: "HI", zip: "96813" },
  { city: "Burlington", state: "VT", zip: "05401" },
  { city: "Portland", state: "ME", zip: "04101" },
  { city: "Manchester", state: "NH", zip: "03101" },
  { city: "Charleston", state: "WV", zip: "25301" },
];

export const STREETS = [
  "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine St", "Elm St",
  "Washington Ave", "Park Blvd", "Lake Rd", "Hill Dr", "5th Ave",
  "Sunset Blvd", "River Rd", "Church St", "Highland Ave", "Franklin St",
  "Madison Ave", "Jefferson St", "Lincoln Way", "Rosewood Ct",
];

export const CARRIERS = [
  "Verizon Wireless", "AT&T Mobility", "T-Mobile", "Sprint",
  "Comcast", "Frontier", "CenturyLink", "Spectrum",
];

export const PHONE_TYPES = ["Cell phone", "Landline", "VoIP"];

export const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "aol.com", "hotmail.com", "icloud.com"];

// ---------- deterministic PRNG ----------

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(seed: string) {
  const rand = mulberry32(hashString(seed.toLowerCase().trim()));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  return { rand, pick, int };
}

export function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

export function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

export const STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

/** Parse a "City, ST" / "City" / "ST" / "State Name" / ZIP input into parts. */
export function parseWhere(where: string): { city?: string; state?: string; zip?: string } {
  const w = where.trim();
  if (!w) return {};
  const zip = w.match(/\b\d{5}\b/)?.[0];
  if (zip) return { zip };

  const parts = w.split(",").map((p) => p.trim()).filter(Boolean);
  const out: { city?: string; state?: string; zip?: string } = {};
  for (const part of parts) {
    if (/^[A-Z]{2}$/i.test(part)) out.state = part.toUpperCase();
    else if (STATE_CODES[part.toLowerCase()]) out.state = STATE_CODES[part.toLowerCase()];
    else if (!out.city) out.city = part;
  }
  if (!out.city && !out.state && parts.length === 1) out.city = parts[0];
  return out;
}
