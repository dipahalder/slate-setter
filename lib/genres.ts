export const GENRE_MAP: Record<string, string[]> = {
  Horror: [
    "Hereditary", "Midsommar", "Halloween Kills", "Speak No Evil",
    "Smile", "The Nun II", "Annabelle", "Alien: Romulus",
    "Scream", "M3GAN", "Nope", "Us", "Get Out",
    "A Quiet Place", "It Chapter Two", "Doctor Sleep",
    "The Black Phone", "Barbarian", "Five Nights at Freddy",
    "Longlegs", "Trap", "Nosferatu", "The Substance",
  ],
  Drama: [
    "Joker", "Joker: Folie à Deux", "The Apprentice", "Tar",
    "The Whale", "All Quiet on the Western Front", "Belfast",
    "Spencer", "The Power of the Dog", "Nightmare Alley",
  ],
  Thriller: [
    "Knives Out", "Glass Onion", "Gone Girl", "No Way Out",
    "Prisoners", "Parasite", "The Menu", "Saltburn",
  ],
  Comedy: [
    "Barbie", "Bros", "Ticket to Paradise", "The Lost City",
    "Marry Me", "Uncut Gems", "Good Boys",
  ],
  Action: [
    "Transformers One", "Top Gun: Maverick", "John Wick",
    "The Batman", "Extraction", "Nobody",
  ],
  Romance: [
    "Anyone But You", "Me Before You", "To All the Boys",
    "The Notebook", "Crazy Rich Asians", "La La Land",
  ],
};

export function matchesGenre(title: string, genre: string): boolean {
  return (GENRE_MAP[genre] ?? []).some((t) => title.includes(t));
}
