-- ============================================================================
-- Bolao Suprema - official FIFA R32 third-place matrix + SQL head-to-head
-- ----------------------------------------------------------------------------
-- Source: Regulations for the FIFA World Cup 26, Annex C (approved 2025-05-09).
-- Annex C defines all 495 possible mappings for the eight best third-placed
-- groups into the Round of 32. This migration replaces the earlier simplified
-- best-third ordering and aligns the backend bracket with the official schedule.
-- ============================================================================

create table if not exists public.third_place_slot_options (
  combination_key text primary key check (combination_key ~ '^[A-L]{8}$'),
  option_no integer not null unique,
  slot_1a text not null check (slot_1a ~ '^[A-L]$'),
  slot_1b text not null check (slot_1b ~ '^[A-L]$'),
  slot_1d text not null check (slot_1d ~ '^[A-L]$'),
  slot_1e text not null check (slot_1e ~ '^[A-L]$'),
  slot_1g text not null check (slot_1g ~ '^[A-L]$'),
  slot_1i text not null check (slot_1i ~ '^[A-L]$'),
  slot_1k text not null check (slot_1k ~ '^[A-L]$'),
  slot_1l text not null check (slot_1l ~ '^[A-L]$')
);

insert into public.third_place_slot_options (
  combination_key, option_no, slot_1a, slot_1b, slot_1d, slot_1e, slot_1g, slot_1i, slot_1k, slot_1l
) values
  ('ABCDEFGH', 495, 'H', 'G', 'B', 'C', 'A', 'F', 'D', 'E'),
  ('ABCDEFGI', 494, 'C', 'G', 'B', 'D', 'A', 'F', 'E', 'I'),
  ('ABCDEFGJ', 493, 'C', 'G', 'B', 'D', 'A', 'F', 'E', 'J'),
  ('ABCDEFGK', 492, 'C', 'G', 'B', 'D', 'A', 'F', 'E', 'K'),
  ('ABCDEFGL', 491, 'C', 'G', 'B', 'D', 'A', 'F', 'L', 'E'),
  ('ABCDEFHI', 490, 'H', 'E', 'B', 'C', 'A', 'F', 'D', 'I'),
  ('ABCDEFHJ', 489, 'H', 'J', 'B', 'C', 'A', 'F', 'D', 'E'),
  ('ABCDEFHK', 488, 'H', 'E', 'B', 'C', 'A', 'F', 'D', 'K'),
  ('ABCDEFHL', 487, 'H', 'F', 'B', 'C', 'A', 'D', 'L', 'E'),
  ('ABCDEFIJ', 486, 'C', 'J', 'B', 'D', 'A', 'F', 'E', 'I'),
  ('ABCDEFIK', 485, 'C', 'E', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABCDEFIL', 484, 'C', 'E', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABCDEFJK', 483, 'C', 'J', 'B', 'D', 'A', 'F', 'E', 'K'),
  ('ABCDEFJL', 482, 'C', 'J', 'B', 'D', 'A', 'F', 'L', 'E'),
  ('ABCDEFKL', 481, 'C', 'E', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABCDEGHI', 480, 'H', 'G', 'B', 'C', 'A', 'D', 'E', 'I'),
  ('ABCDEGHJ', 479, 'H', 'G', 'B', 'C', 'A', 'D', 'E', 'J'),
  ('ABCDEGHK', 478, 'H', 'G', 'B', 'C', 'A', 'D', 'E', 'K'),
  ('ABCDEGHL', 477, 'H', 'G', 'B', 'C', 'A', 'D', 'L', 'E'),
  ('ABCDEGIJ', 476, 'E', 'G', 'B', 'C', 'A', 'D', 'I', 'J'),
  ('ABCDEGIK', 475, 'E', 'G', 'B', 'C', 'A', 'D', 'I', 'K'),
  ('ABCDEGIL', 474, 'E', 'G', 'B', 'C', 'A', 'D', 'L', 'I'),
  ('ABCDEGJK', 473, 'E', 'G', 'B', 'C', 'A', 'D', 'J', 'K'),
  ('ABCDEGJL', 472, 'E', 'G', 'B', 'C', 'A', 'D', 'L', 'J'),
  ('ABCDEGKL', 471, 'E', 'G', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDEHIJ', 470, 'H', 'J', 'B', 'C', 'A', 'D', 'E', 'I'),
  ('ABCDEHIK', 469, 'H', 'E', 'B', 'C', 'A', 'D', 'I', 'K'),
  ('ABCDEHIL', 468, 'H', 'E', 'B', 'C', 'A', 'D', 'L', 'I'),
  ('ABCDEHJK', 467, 'H', 'J', 'B', 'C', 'A', 'D', 'E', 'K'),
  ('ABCDEHJL', 466, 'H', 'J', 'B', 'C', 'A', 'D', 'L', 'E'),
  ('ABCDEHKL', 465, 'H', 'E', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDEIJK', 464, 'E', 'J', 'B', 'C', 'A', 'D', 'I', 'K'),
  ('ABCDEIJL', 463, 'E', 'J', 'B', 'C', 'A', 'D', 'L', 'I'),
  ('ABCDEIKL', 462, 'E', 'I', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDEJKL', 461, 'E', 'J', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDFGHI', 460, 'H', 'G', 'B', 'C', 'A', 'F', 'D', 'I'),
  ('ABCDFGHJ', 459, 'H', 'G', 'B', 'C', 'A', 'F', 'D', 'J'),
  ('ABCDFGHK', 458, 'H', 'G', 'B', 'C', 'A', 'F', 'D', 'K'),
  ('ABCDFGHL', 457, 'C', 'G', 'B', 'D', 'A', 'F', 'L', 'H'),
  ('ABCDFGIJ', 456, 'C', 'G', 'B', 'D', 'A', 'F', 'I', 'J'),
  ('ABCDFGIK', 455, 'C', 'G', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABCDFGIL', 454, 'C', 'G', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABCDFGJK', 453, 'C', 'G', 'B', 'D', 'A', 'F', 'J', 'K'),
  ('ABCDFGJL', 452, 'C', 'G', 'B', 'D', 'A', 'F', 'L', 'J'),
  ('ABCDFGKL', 451, 'C', 'G', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABCDFHIJ', 450, 'H', 'J', 'B', 'C', 'A', 'F', 'D', 'I'),
  ('ABCDFHIK', 449, 'H', 'F', 'B', 'C', 'A', 'D', 'I', 'K'),
  ('ABCDFHIL', 448, 'H', 'F', 'B', 'C', 'A', 'D', 'L', 'I'),
  ('ABCDFHJK', 447, 'H', 'J', 'B', 'C', 'A', 'F', 'D', 'K'),
  ('ABCDFHJL', 446, 'C', 'J', 'B', 'D', 'A', 'F', 'L', 'H'),
  ('ABCDFHKL', 445, 'H', 'F', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDFIJK', 444, 'C', 'J', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABCDFIJL', 443, 'C', 'J', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABCDFIKL', 442, 'C', 'I', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABCDFJKL', 441, 'C', 'J', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABCDGHIJ', 440, 'H', 'G', 'B', 'C', 'A', 'D', 'I', 'J'),
  ('ABCDGHIK', 439, 'H', 'G', 'B', 'C', 'A', 'D', 'I', 'K'),
  ('ABCDGHIL', 438, 'H', 'G', 'B', 'C', 'A', 'D', 'L', 'I'),
  ('ABCDGHJK', 437, 'H', 'G', 'B', 'C', 'A', 'D', 'J', 'K'),
  ('ABCDGHJL', 436, 'H', 'G', 'B', 'C', 'A', 'D', 'L', 'J'),
  ('ABCDGHKL', 435, 'H', 'G', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDGIJK', 434, 'C', 'J', 'B', 'D', 'A', 'G', 'I', 'K'),
  ('ABCDGIJL', 433, 'C', 'J', 'B', 'D', 'A', 'G', 'L', 'I'),
  ('ABCDGIKL', 432, 'I', 'G', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDGJKL', 431, 'C', 'J', 'B', 'D', 'A', 'G', 'L', 'K'),
  ('ABCDHIJK', 430, 'H', 'J', 'B', 'C', 'A', 'D', 'I', 'K'),
  ('ABCDHIJL', 429, 'H', 'J', 'B', 'C', 'A', 'D', 'L', 'I'),
  ('ABCDHIKL', 428, 'H', 'I', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDHJKL', 427, 'H', 'J', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCDIJKL', 426, 'I', 'J', 'B', 'C', 'A', 'D', 'L', 'K'),
  ('ABCEFGHI', 425, 'H', 'G', 'B', 'C', 'A', 'F', 'E', 'I'),
  ('ABCEFGHJ', 424, 'H', 'G', 'B', 'C', 'A', 'F', 'E', 'J'),
  ('ABCEFGHK', 423, 'H', 'G', 'B', 'C', 'A', 'F', 'E', 'K'),
  ('ABCEFGHL', 422, 'H', 'G', 'B', 'C', 'A', 'F', 'L', 'E'),
  ('ABCEFGIJ', 421, 'E', 'G', 'B', 'C', 'A', 'F', 'I', 'J'),
  ('ABCEFGIK', 420, 'E', 'G', 'B', 'C', 'A', 'F', 'I', 'K'),
  ('ABCEFGIL', 419, 'E', 'G', 'B', 'C', 'A', 'F', 'L', 'I'),
  ('ABCEFGJK', 418, 'E', 'G', 'B', 'C', 'A', 'F', 'J', 'K'),
  ('ABCEFGJL', 417, 'E', 'G', 'B', 'C', 'A', 'F', 'L', 'J'),
  ('ABCEFGKL', 416, 'E', 'G', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCEFHIJ', 415, 'H', 'J', 'B', 'C', 'A', 'F', 'E', 'I'),
  ('ABCEFHIK', 414, 'H', 'E', 'B', 'C', 'A', 'F', 'I', 'K'),
  ('ABCEFHIL', 413, 'H', 'E', 'B', 'C', 'A', 'F', 'L', 'I'),
  ('ABCEFHJK', 412, 'H', 'J', 'B', 'C', 'A', 'F', 'E', 'K'),
  ('ABCEFHJL', 411, 'H', 'J', 'B', 'C', 'A', 'F', 'L', 'E'),
  ('ABCEFHKL', 410, 'H', 'E', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCEFIJK', 409, 'E', 'J', 'B', 'C', 'A', 'F', 'I', 'K'),
  ('ABCEFIJL', 408, 'E', 'J', 'B', 'C', 'A', 'F', 'L', 'I'),
  ('ABCEFIKL', 407, 'E', 'I', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCEFJKL', 406, 'E', 'J', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCEGHIJ', 405, 'H', 'J', 'B', 'C', 'A', 'G', 'E', 'I'),
  ('ABCEGHIK', 404, 'E', 'G', 'B', 'C', 'A', 'H', 'I', 'K'),
  ('ABCEGHIL', 403, 'E', 'G', 'B', 'C', 'A', 'H', 'L', 'I'),
  ('ABCEGHJK', 402, 'H', 'J', 'B', 'C', 'A', 'G', 'E', 'K'),
  ('ABCEGHJL', 401, 'H', 'J', 'B', 'C', 'A', 'G', 'L', 'E'),
  ('ABCEGHKL', 400, 'E', 'G', 'B', 'C', 'A', 'H', 'L', 'K'),
  ('ABCEGIJK', 399, 'E', 'J', 'B', 'C', 'A', 'G', 'I', 'K'),
  ('ABCEGIJL', 398, 'E', 'J', 'B', 'C', 'A', 'G', 'L', 'I'),
  ('ABCEGIKL', 397, 'E', 'G', 'B', 'A', 'I', 'C', 'L', 'K'),
  ('ABCEGJKL', 396, 'E', 'J', 'B', 'C', 'A', 'G', 'L', 'K'),
  ('ABCEHIJK', 395, 'E', 'J', 'B', 'C', 'A', 'H', 'I', 'K'),
  ('ABCEHIJL', 394, 'E', 'J', 'B', 'C', 'A', 'H', 'L', 'I'),
  ('ABCEHIKL', 393, 'E', 'I', 'B', 'C', 'A', 'H', 'L', 'K'),
  ('ABCEHJKL', 392, 'E', 'J', 'B', 'C', 'A', 'H', 'L', 'K'),
  ('ABCEIJKL', 391, 'E', 'J', 'B', 'A', 'I', 'C', 'L', 'K'),
  ('ABCFGHIJ', 390, 'H', 'G', 'B', 'C', 'A', 'F', 'I', 'J'),
  ('ABCFGHIK', 389, 'H', 'G', 'B', 'C', 'A', 'F', 'I', 'K'),
  ('ABCFGHIL', 388, 'H', 'G', 'B', 'C', 'A', 'F', 'L', 'I'),
  ('ABCFGHJK', 387, 'H', 'G', 'B', 'C', 'A', 'F', 'J', 'K'),
  ('ABCFGHJL', 386, 'H', 'G', 'B', 'C', 'A', 'F', 'L', 'J'),
  ('ABCFGHKL', 385, 'H', 'G', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCFGIJK', 384, 'C', 'J', 'B', 'F', 'A', 'G', 'I', 'K'),
  ('ABCFGIJL', 383, 'C', 'J', 'B', 'F', 'A', 'G', 'L', 'I'),
  ('ABCFGIKL', 382, 'I', 'G', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCFGJKL', 381, 'C', 'J', 'B', 'F', 'A', 'G', 'L', 'K'),
  ('ABCFHIJK', 380, 'H', 'J', 'B', 'C', 'A', 'F', 'I', 'K'),
  ('ABCFHIJL', 379, 'H', 'J', 'B', 'C', 'A', 'F', 'L', 'I'),
  ('ABCFHIKL', 378, 'H', 'I', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCFHJKL', 377, 'H', 'J', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCFIJKL', 376, 'I', 'J', 'B', 'C', 'A', 'F', 'L', 'K'),
  ('ABCGHIJK', 375, 'H', 'J', 'B', 'C', 'A', 'G', 'I', 'K'),
  ('ABCGHIJL', 374, 'H', 'J', 'B', 'C', 'A', 'G', 'L', 'I'),
  ('ABCGHIKL', 373, 'I', 'G', 'B', 'C', 'A', 'H', 'L', 'K'),
  ('ABCGHJKL', 372, 'H', 'J', 'B', 'C', 'A', 'G', 'L', 'K'),
  ('ABCGIJKL', 371, 'I', 'J', 'B', 'C', 'A', 'G', 'L', 'K'),
  ('ABCHIJKL', 370, 'I', 'J', 'B', 'C', 'A', 'H', 'L', 'K'),
  ('ABDEFGHI', 369, 'H', 'G', 'B', 'D', 'A', 'F', 'E', 'I'),
  ('ABDEFGHJ', 368, 'H', 'G', 'B', 'D', 'A', 'F', 'E', 'J'),
  ('ABDEFGHK', 367, 'H', 'G', 'B', 'D', 'A', 'F', 'E', 'K'),
  ('ABDEFGHL', 366, 'H', 'G', 'B', 'D', 'A', 'F', 'L', 'E'),
  ('ABDEFGIJ', 365, 'E', 'G', 'B', 'D', 'A', 'F', 'I', 'J'),
  ('ABDEFGIK', 364, 'E', 'G', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABDEFGIL', 363, 'E', 'G', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABDEFGJK', 362, 'E', 'G', 'B', 'D', 'A', 'F', 'J', 'K'),
  ('ABDEFGJL', 361, 'E', 'G', 'B', 'D', 'A', 'F', 'L', 'J'),
  ('ABDEFGKL', 360, 'E', 'G', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDEFHIJ', 359, 'H', 'J', 'B', 'D', 'A', 'F', 'E', 'I'),
  ('ABDEFHIK', 358, 'H', 'E', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABDEFHIL', 357, 'H', 'E', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABDEFHJK', 356, 'H', 'J', 'B', 'D', 'A', 'F', 'E', 'K'),
  ('ABDEFHJL', 355, 'H', 'J', 'B', 'D', 'A', 'F', 'L', 'E'),
  ('ABDEFHKL', 354, 'H', 'E', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDEFIJK', 353, 'E', 'J', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABDEFIJL', 352, 'E', 'J', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABDEFIKL', 351, 'E', 'I', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDEFJKL', 350, 'E', 'J', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDEGHIJ', 349, 'H', 'J', 'B', 'D', 'A', 'G', 'E', 'I'),
  ('ABDEGHIK', 348, 'E', 'G', 'B', 'D', 'A', 'H', 'I', 'K'),
  ('ABDEGHIL', 347, 'E', 'G', 'B', 'D', 'A', 'H', 'L', 'I'),
  ('ABDEGHJK', 346, 'H', 'J', 'B', 'D', 'A', 'G', 'E', 'K'),
  ('ABDEGHJL', 345, 'H', 'J', 'B', 'D', 'A', 'G', 'L', 'E'),
  ('ABDEGHKL', 344, 'E', 'G', 'B', 'D', 'A', 'H', 'L', 'K'),
  ('ABDEGIJK', 343, 'E', 'J', 'B', 'D', 'A', 'G', 'I', 'K'),
  ('ABDEGIJL', 342, 'E', 'J', 'B', 'D', 'A', 'G', 'L', 'I'),
  ('ABDEGIKL', 341, 'E', 'G', 'B', 'A', 'I', 'D', 'L', 'K'),
  ('ABDEGJKL', 340, 'E', 'J', 'B', 'D', 'A', 'G', 'L', 'K'),
  ('ABDEHIJK', 339, 'E', 'J', 'B', 'D', 'A', 'H', 'I', 'K'),
  ('ABDEHIJL', 338, 'E', 'J', 'B', 'D', 'A', 'H', 'L', 'I'),
  ('ABDEHIKL', 337, 'E', 'I', 'B', 'D', 'A', 'H', 'L', 'K'),
  ('ABDEHJKL', 336, 'E', 'J', 'B', 'D', 'A', 'H', 'L', 'K'),
  ('ABDEIJKL', 335, 'E', 'J', 'B', 'A', 'I', 'D', 'L', 'K'),
  ('ABDFGHIJ', 334, 'H', 'G', 'B', 'D', 'A', 'F', 'I', 'J'),
  ('ABDFGHIK', 333, 'H', 'G', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABDFGHIL', 332, 'H', 'G', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABDFGHJK', 331, 'H', 'G', 'B', 'D', 'A', 'F', 'J', 'K'),
  ('ABDFGHJL', 330, 'H', 'G', 'B', 'D', 'A', 'F', 'L', 'J'),
  ('ABDFGHKL', 329, 'H', 'G', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDFGIJK', 328, 'F', 'J', 'B', 'D', 'A', 'G', 'I', 'K'),
  ('ABDFGIJL', 327, 'F', 'J', 'B', 'D', 'A', 'G', 'L', 'I'),
  ('ABDFGIKL', 326, 'I', 'G', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDFGJKL', 325, 'F', 'J', 'B', 'D', 'A', 'G', 'L', 'K'),
  ('ABDFHIJK', 324, 'H', 'J', 'B', 'D', 'A', 'F', 'I', 'K'),
  ('ABDFHIJL', 323, 'H', 'J', 'B', 'D', 'A', 'F', 'L', 'I'),
  ('ABDFHIKL', 322, 'H', 'I', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDFHJKL', 321, 'H', 'J', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDFIJKL', 320, 'I', 'J', 'B', 'D', 'A', 'F', 'L', 'K'),
  ('ABDGHIJK', 319, 'H', 'J', 'B', 'D', 'A', 'G', 'I', 'K'),
  ('ABDGHIJL', 318, 'H', 'J', 'B', 'D', 'A', 'G', 'L', 'I'),
  ('ABDGHIKL', 317, 'I', 'G', 'B', 'D', 'A', 'H', 'L', 'K'),
  ('ABDGHJKL', 316, 'H', 'J', 'B', 'D', 'A', 'G', 'L', 'K'),
  ('ABDGIJKL', 315, 'I', 'J', 'B', 'D', 'A', 'G', 'L', 'K'),
  ('ABDHIJKL', 314, 'I', 'J', 'B', 'D', 'A', 'H', 'L', 'K'),
  ('ABEFGHIJ', 313, 'H', 'J', 'B', 'F', 'A', 'G', 'E', 'I'),
  ('ABEFGHIK', 312, 'E', 'G', 'B', 'F', 'A', 'H', 'I', 'K'),
  ('ABEFGHIL', 311, 'E', 'G', 'B', 'F', 'A', 'H', 'L', 'I'),
  ('ABEFGHJK', 310, 'H', 'J', 'B', 'F', 'A', 'G', 'E', 'K'),
  ('ABEFGHJL', 309, 'H', 'J', 'B', 'F', 'A', 'G', 'L', 'E'),
  ('ABEFGHKL', 308, 'E', 'G', 'B', 'F', 'A', 'H', 'L', 'K'),
  ('ABEFGIJK', 307, 'E', 'J', 'B', 'F', 'A', 'G', 'I', 'K'),
  ('ABEFGIJL', 306, 'E', 'J', 'B', 'F', 'A', 'G', 'L', 'I'),
  ('ABEFGIKL', 305, 'E', 'G', 'B', 'A', 'I', 'F', 'L', 'K'),
  ('ABEFGJKL', 304, 'E', 'J', 'B', 'F', 'A', 'G', 'L', 'K'),
  ('ABEFHIJK', 303, 'E', 'J', 'B', 'F', 'A', 'H', 'I', 'K'),
  ('ABEFHIJL', 302, 'E', 'J', 'B', 'F', 'A', 'H', 'L', 'I'),
  ('ABEFHIKL', 301, 'E', 'I', 'B', 'F', 'A', 'H', 'L', 'K'),
  ('ABEFHJKL', 300, 'E', 'J', 'B', 'F', 'A', 'H', 'L', 'K'),
  ('ABEFIJKL', 299, 'E', 'J', 'B', 'A', 'I', 'F', 'L', 'K'),
  ('ABEGHIJK', 298, 'E', 'J', 'B', 'A', 'H', 'G', 'I', 'K'),
  ('ABEGHIJL', 297, 'E', 'J', 'B', 'A', 'H', 'G', 'L', 'I'),
  ('ABEGHIKL', 296, 'E', 'G', 'B', 'A', 'I', 'H', 'L', 'K'),
  ('ABEGHJKL', 295, 'E', 'J', 'B', 'A', 'H', 'G', 'L', 'K'),
  ('ABEGIJKL', 294, 'E', 'J', 'B', 'A', 'I', 'G', 'L', 'K'),
  ('ABEHIJKL', 293, 'E', 'J', 'B', 'A', 'I', 'H', 'L', 'K'),
  ('ABFGHIJK', 292, 'H', 'J', 'B', 'F', 'A', 'G', 'I', 'K'),
  ('ABFGHIJL', 291, 'H', 'J', 'B', 'F', 'A', 'G', 'L', 'I'),
  ('ABFGHIKL', 290, 'H', 'G', 'B', 'A', 'I', 'F', 'L', 'K'),
  ('ABFGHJKL', 289, 'H', 'J', 'B', 'F', 'A', 'G', 'L', 'K'),
  ('ABFGIJKL', 288, 'I', 'J', 'B', 'F', 'A', 'G', 'L', 'K'),
  ('ABFHIJKL', 287, 'H', 'J', 'B', 'A', 'I', 'F', 'L', 'K'),
  ('ABGHIJKL', 286, 'H', 'J', 'B', 'A', 'I', 'G', 'L', 'K'),
  ('ACDEFGHI', 285, 'H', 'G', 'E', 'C', 'A', 'F', 'D', 'I'),
  ('ACDEFGHJ', 284, 'H', 'G', 'J', 'C', 'A', 'F', 'D', 'E'),
  ('ACDEFGHK', 283, 'H', 'G', 'E', 'C', 'A', 'F', 'D', 'K'),
  ('ACDEFGHL', 282, 'H', 'G', 'F', 'C', 'A', 'D', 'L', 'E'),
  ('ACDEFGIJ', 281, 'C', 'G', 'J', 'D', 'A', 'F', 'E', 'I'),
  ('ACDEFGIK', 280, 'C', 'G', 'E', 'D', 'A', 'F', 'I', 'K'),
  ('ACDEFGIL', 279, 'C', 'G', 'E', 'D', 'A', 'F', 'L', 'I'),
  ('ACDEFGJK', 278, 'C', 'G', 'J', 'D', 'A', 'F', 'E', 'K'),
  ('ACDEFGJL', 277, 'C', 'G', 'J', 'D', 'A', 'F', 'L', 'E'),
  ('ACDEFGKL', 276, 'C', 'G', 'E', 'D', 'A', 'F', 'L', 'K'),
  ('ACDEFHIJ', 275, 'H', 'J', 'E', 'C', 'A', 'F', 'D', 'I'),
  ('ACDEFHIK', 274, 'H', 'E', 'F', 'C', 'A', 'D', 'I', 'K'),
  ('ACDEFHIL', 273, 'H', 'E', 'F', 'C', 'A', 'D', 'L', 'I'),
  ('ACDEFHJK', 272, 'H', 'J', 'E', 'C', 'A', 'F', 'D', 'K'),
  ('ACDEFHJL', 271, 'H', 'J', 'F', 'C', 'A', 'D', 'L', 'E'),
  ('ACDEFHKL', 270, 'H', 'E', 'F', 'C', 'A', 'D', 'L', 'K'),
  ('ACDEFIJK', 269, 'C', 'J', 'E', 'D', 'A', 'F', 'I', 'K'),
  ('ACDEFIJL', 268, 'C', 'J', 'E', 'D', 'A', 'F', 'L', 'I'),
  ('ACDEFIKL', 267, 'C', 'E', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ACDEFJKL', 266, 'C', 'J', 'E', 'D', 'A', 'F', 'L', 'K'),
  ('ACDEGHIJ', 265, 'H', 'G', 'J', 'C', 'A', 'D', 'E', 'I'),
  ('ACDEGHIK', 264, 'H', 'G', 'E', 'C', 'A', 'D', 'I', 'K'),
  ('ACDEGHIL', 263, 'H', 'G', 'E', 'C', 'A', 'D', 'L', 'I'),
  ('ACDEGHJK', 262, 'H', 'G', 'J', 'C', 'A', 'D', 'E', 'K'),
  ('ACDEGHJL', 261, 'H', 'G', 'J', 'C', 'A', 'D', 'L', 'E'),
  ('ACDEGHKL', 260, 'H', 'G', 'E', 'C', 'A', 'D', 'L', 'K'),
  ('ACDEGIJK', 259, 'E', 'G', 'J', 'C', 'A', 'D', 'I', 'K'),
  ('ACDEGIJL', 258, 'E', 'G', 'J', 'C', 'A', 'D', 'L', 'I'),
  ('ACDEGIKL', 257, 'E', 'G', 'I', 'C', 'A', 'D', 'L', 'K'),
  ('ACDEGJKL', 256, 'E', 'G', 'J', 'C', 'A', 'D', 'L', 'K'),
  ('ACDEHIJK', 255, 'H', 'J', 'E', 'C', 'A', 'D', 'I', 'K'),
  ('ACDEHIJL', 254, 'H', 'J', 'E', 'C', 'A', 'D', 'L', 'I'),
  ('ACDEHIKL', 253, 'H', 'E', 'I', 'C', 'A', 'D', 'L', 'K'),
  ('ACDEHJKL', 252, 'H', 'J', 'E', 'C', 'A', 'D', 'L', 'K'),
  ('ACDEIJKL', 251, 'E', 'J', 'I', 'C', 'A', 'D', 'L', 'K'),
  ('ACDFGHIJ', 250, 'H', 'G', 'J', 'C', 'A', 'F', 'D', 'I'),
  ('ACDFGHIK', 249, 'H', 'G', 'F', 'C', 'A', 'D', 'I', 'K'),
  ('ACDFGHIL', 248, 'H', 'G', 'F', 'C', 'A', 'D', 'L', 'I'),
  ('ACDFGHJK', 247, 'H', 'G', 'J', 'C', 'A', 'F', 'D', 'K'),
  ('ACDFGHJL', 246, 'C', 'G', 'J', 'D', 'A', 'F', 'L', 'H'),
  ('ACDFGHKL', 245, 'H', 'G', 'F', 'C', 'A', 'D', 'L', 'K'),
  ('ACDFGIJK', 244, 'C', 'G', 'J', 'D', 'A', 'F', 'I', 'K'),
  ('ACDFGIJL', 243, 'C', 'G', 'J', 'D', 'A', 'F', 'L', 'I'),
  ('ACDFGIKL', 242, 'C', 'G', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ACDFGJKL', 241, 'C', 'G', 'J', 'D', 'A', 'F', 'L', 'K'),
  ('ACDFHIJK', 240, 'H', 'J', 'F', 'C', 'A', 'D', 'I', 'K'),
  ('ACDFHIJL', 239, 'H', 'J', 'F', 'C', 'A', 'D', 'L', 'I'),
  ('ACDFHIKL', 238, 'H', 'F', 'I', 'C', 'A', 'D', 'L', 'K'),
  ('ACDFHJKL', 237, 'H', 'J', 'F', 'C', 'A', 'D', 'L', 'K'),
  ('ACDFIJKL', 236, 'C', 'J', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ACDGHIJK', 235, 'H', 'G', 'J', 'C', 'A', 'D', 'I', 'K'),
  ('ACDGHIJL', 234, 'H', 'G', 'J', 'C', 'A', 'D', 'L', 'I'),
  ('ACDGHIKL', 233, 'H', 'G', 'I', 'C', 'A', 'D', 'L', 'K'),
  ('ACDGHJKL', 232, 'H', 'G', 'J', 'C', 'A', 'D', 'L', 'K'),
  ('ACDGIJKL', 231, 'I', 'G', 'J', 'C', 'A', 'D', 'L', 'K'),
  ('ACDHIJKL', 230, 'H', 'J', 'I', 'C', 'A', 'D', 'L', 'K'),
  ('ACEFGHIJ', 229, 'H', 'G', 'J', 'C', 'A', 'F', 'E', 'I'),
  ('ACEFGHIK', 228, 'H', 'G', 'E', 'C', 'A', 'F', 'I', 'K'),
  ('ACEFGHIL', 227, 'H', 'G', 'E', 'C', 'A', 'F', 'L', 'I'),
  ('ACEFGHJK', 226, 'H', 'G', 'J', 'C', 'A', 'F', 'E', 'K'),
  ('ACEFGHJL', 225, 'H', 'G', 'J', 'C', 'A', 'F', 'L', 'E'),
  ('ACEFGHKL', 224, 'H', 'G', 'E', 'C', 'A', 'F', 'L', 'K'),
  ('ACEFGIJK', 223, 'E', 'G', 'J', 'C', 'A', 'F', 'I', 'K'),
  ('ACEFGIJL', 222, 'E', 'G', 'J', 'C', 'A', 'F', 'L', 'I'),
  ('ACEFGIKL', 221, 'E', 'G', 'I', 'C', 'A', 'F', 'L', 'K'),
  ('ACEFGJKL', 220, 'E', 'G', 'J', 'C', 'A', 'F', 'L', 'K'),
  ('ACEFHIJK', 219, 'H', 'J', 'E', 'C', 'A', 'F', 'I', 'K'),
  ('ACEFHIJL', 218, 'H', 'J', 'E', 'C', 'A', 'F', 'L', 'I'),
  ('ACEFHIKL', 217, 'H', 'E', 'I', 'C', 'A', 'F', 'L', 'K'),
  ('ACEFHJKL', 216, 'H', 'J', 'E', 'C', 'A', 'F', 'L', 'K'),
  ('ACEFIJKL', 215, 'E', 'J', 'I', 'C', 'A', 'F', 'L', 'K'),
  ('ACEGHIJK', 214, 'E', 'G', 'J', 'C', 'A', 'H', 'I', 'K'),
  ('ACEGHIJL', 213, 'E', 'G', 'J', 'C', 'A', 'H', 'L', 'I'),
  ('ACEGHIKL', 212, 'E', 'G', 'I', 'C', 'A', 'H', 'L', 'K'),
  ('ACEGHJKL', 211, 'E', 'G', 'J', 'C', 'A', 'H', 'L', 'K'),
  ('ACEGIJKL', 210, 'E', 'J', 'I', 'C', 'A', 'G', 'L', 'K'),
  ('ACEHIJKL', 209, 'E', 'J', 'I', 'C', 'A', 'H', 'L', 'K'),
  ('ACFGHIJK', 208, 'H', 'G', 'J', 'C', 'A', 'F', 'I', 'K'),
  ('ACFGHIJL', 207, 'H', 'G', 'J', 'C', 'A', 'F', 'L', 'I'),
  ('ACFGHIKL', 206, 'H', 'G', 'I', 'C', 'A', 'F', 'L', 'K'),
  ('ACFGHJKL', 205, 'H', 'G', 'J', 'C', 'A', 'F', 'L', 'K'),
  ('ACFGIJKL', 204, 'I', 'G', 'J', 'C', 'A', 'F', 'L', 'K'),
  ('ACFHIJKL', 203, 'H', 'J', 'I', 'C', 'A', 'F', 'L', 'K'),
  ('ACGHIJKL', 202, 'H', 'J', 'I', 'C', 'A', 'G', 'L', 'K'),
  ('ADEFGHIJ', 201, 'H', 'G', 'J', 'D', 'A', 'F', 'E', 'I'),
  ('ADEFGHIK', 200, 'H', 'G', 'E', 'D', 'A', 'F', 'I', 'K'),
  ('ADEFGHIL', 199, 'H', 'G', 'E', 'D', 'A', 'F', 'L', 'I'),
  ('ADEFGHJK', 198, 'H', 'G', 'J', 'D', 'A', 'F', 'E', 'K'),
  ('ADEFGHJL', 197, 'H', 'G', 'J', 'D', 'A', 'F', 'L', 'E'),
  ('ADEFGHKL', 196, 'H', 'G', 'E', 'D', 'A', 'F', 'L', 'K'),
  ('ADEFGIJK', 195, 'E', 'G', 'J', 'D', 'A', 'F', 'I', 'K'),
  ('ADEFGIJL', 194, 'E', 'G', 'J', 'D', 'A', 'F', 'L', 'I'),
  ('ADEFGIKL', 193, 'E', 'G', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ADEFGJKL', 192, 'E', 'G', 'J', 'D', 'A', 'F', 'L', 'K'),
  ('ADEFHIJK', 191, 'H', 'J', 'E', 'D', 'A', 'F', 'I', 'K'),
  ('ADEFHIJL', 190, 'H', 'J', 'E', 'D', 'A', 'F', 'L', 'I'),
  ('ADEFHIKL', 189, 'H', 'E', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ADEFHJKL', 188, 'H', 'J', 'E', 'D', 'A', 'F', 'L', 'K'),
  ('ADEFIJKL', 187, 'E', 'J', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ADEGHIJK', 186, 'E', 'G', 'J', 'D', 'A', 'H', 'I', 'K'),
  ('ADEGHIJL', 185, 'E', 'G', 'J', 'D', 'A', 'H', 'L', 'I'),
  ('ADEGHIKL', 184, 'E', 'G', 'I', 'D', 'A', 'H', 'L', 'K'),
  ('ADEGHJKL', 183, 'E', 'G', 'J', 'D', 'A', 'H', 'L', 'K'),
  ('ADEGIJKL', 182, 'E', 'J', 'I', 'D', 'A', 'G', 'L', 'K'),
  ('ADEHIJKL', 181, 'E', 'J', 'I', 'D', 'A', 'H', 'L', 'K'),
  ('ADFGHIJK', 180, 'H', 'G', 'J', 'D', 'A', 'F', 'I', 'K'),
  ('ADFGHIJL', 179, 'H', 'G', 'J', 'D', 'A', 'F', 'L', 'I'),
  ('ADFGHIKL', 178, 'H', 'G', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ADFGHJKL', 177, 'H', 'G', 'J', 'D', 'A', 'F', 'L', 'K'),
  ('ADFGIJKL', 176, 'I', 'G', 'J', 'D', 'A', 'F', 'L', 'K'),
  ('ADFHIJKL', 175, 'H', 'J', 'I', 'D', 'A', 'F', 'L', 'K'),
  ('ADGHIJKL', 174, 'H', 'J', 'I', 'D', 'A', 'G', 'L', 'K'),
  ('AEFGHIJK', 173, 'E', 'G', 'J', 'F', 'A', 'H', 'I', 'K'),
  ('AEFGHIJL', 172, 'E', 'G', 'J', 'F', 'A', 'H', 'L', 'I'),
  ('AEFGHIKL', 171, 'E', 'G', 'I', 'F', 'A', 'H', 'L', 'K'),
  ('AEFGHJKL', 170, 'E', 'G', 'J', 'F', 'A', 'H', 'L', 'K'),
  ('AEFGIJKL', 169, 'E', 'J', 'I', 'F', 'A', 'G', 'L', 'K'),
  ('AEFHIJKL', 168, 'E', 'J', 'I', 'F', 'A', 'H', 'L', 'K'),
  ('AEGHIJKL', 167, 'E', 'J', 'I', 'A', 'H', 'G', 'L', 'K'),
  ('AFGHIJKL', 166, 'H', 'J', 'I', 'F', 'A', 'G', 'L', 'K'),
  ('BCDEFGHI', 165, 'C', 'G', 'B', 'D', 'H', 'F', 'E', 'I'),
  ('BCDEFGHJ', 164, 'H', 'G', 'B', 'C', 'J', 'F', 'D', 'E'),
  ('BCDEFGHK', 163, 'C', 'G', 'B', 'D', 'H', 'F', 'E', 'K'),
  ('BCDEFGHL', 162, 'C', 'G', 'B', 'D', 'H', 'F', 'L', 'E'),
  ('BCDEFGIJ', 161, 'C', 'G', 'B', 'D', 'J', 'F', 'E', 'I'),
  ('BCDEFGIK', 160, 'C', 'G', 'B', 'D', 'E', 'F', 'I', 'K'),
  ('BCDEFGIL', 159, 'C', 'G', 'B', 'D', 'E', 'F', 'L', 'I'),
  ('BCDEFGJK', 158, 'C', 'G', 'B', 'D', 'J', 'F', 'E', 'K'),
  ('BCDEFGJL', 157, 'C', 'G', 'B', 'D', 'J', 'F', 'L', 'E'),
  ('BCDEFGKL', 156, 'C', 'G', 'B', 'D', 'E', 'F', 'L', 'K'),
  ('BCDEFHIJ', 155, 'C', 'J', 'B', 'D', 'H', 'F', 'E', 'I'),
  ('BCDEFHIK', 154, 'C', 'E', 'B', 'D', 'H', 'F', 'I', 'K'),
  ('BCDEFHIL', 153, 'C', 'E', 'B', 'D', 'H', 'F', 'L', 'I'),
  ('BCDEFHJK', 152, 'C', 'J', 'B', 'D', 'H', 'F', 'E', 'K'),
  ('BCDEFHJL', 151, 'C', 'J', 'B', 'D', 'H', 'F', 'L', 'E'),
  ('BCDEFHKL', 150, 'C', 'E', 'B', 'D', 'H', 'F', 'L', 'K'),
  ('BCDEFIJK', 149, 'C', 'J', 'B', 'D', 'E', 'F', 'I', 'K'),
  ('BCDEFIJL', 148, 'C', 'J', 'B', 'D', 'E', 'F', 'L', 'I'),
  ('BCDEFIKL', 147, 'C', 'E', 'B', 'D', 'I', 'F', 'L', 'K'),
  ('BCDEFJKL', 146, 'C', 'J', 'B', 'D', 'E', 'F', 'L', 'K'),
  ('BCDEGHIJ', 145, 'H', 'G', 'B', 'C', 'J', 'D', 'E', 'I'),
  ('BCDEGHIK', 144, 'E', 'G', 'B', 'C', 'H', 'D', 'I', 'K'),
  ('BCDEGHIL', 143, 'E', 'G', 'B', 'C', 'H', 'D', 'L', 'I'),
  ('BCDEGHJK', 142, 'H', 'G', 'B', 'C', 'J', 'D', 'E', 'K'),
  ('BCDEGHJL', 141, 'H', 'G', 'B', 'C', 'J', 'D', 'L', 'E'),
  ('BCDEGHKL', 140, 'E', 'G', 'B', 'C', 'H', 'D', 'L', 'K'),
  ('BCDEGIJK', 139, 'E', 'G', 'B', 'C', 'J', 'D', 'I', 'K'),
  ('BCDEGIJL', 138, 'E', 'G', 'B', 'C', 'J', 'D', 'L', 'I'),
  ('BCDEGIKL', 137, 'E', 'G', 'B', 'C', 'I', 'D', 'L', 'K'),
  ('BCDEGJKL', 136, 'E', 'G', 'B', 'C', 'J', 'D', 'L', 'K'),
  ('BCDEHIJK', 135, 'E', 'J', 'B', 'C', 'H', 'D', 'I', 'K'),
  ('BCDEHIJL', 134, 'E', 'J', 'B', 'C', 'H', 'D', 'L', 'I'),
  ('BCDEHIKL', 133, 'E', 'I', 'B', 'C', 'H', 'D', 'L', 'K'),
  ('BCDEHJKL', 132, 'E', 'J', 'B', 'C', 'H', 'D', 'L', 'K'),
  ('BCDEIJKL', 131, 'E', 'J', 'B', 'C', 'I', 'D', 'L', 'K'),
  ('BCDFGHIJ', 130, 'H', 'G', 'B', 'C', 'J', 'F', 'D', 'I'),
  ('BCDFGHIK', 129, 'C', 'G', 'B', 'D', 'H', 'F', 'I', 'K'),
  ('BCDFGHIL', 128, 'C', 'G', 'B', 'D', 'H', 'F', 'L', 'I'),
  ('BCDFGHJK', 127, 'H', 'G', 'B', 'C', 'J', 'F', 'D', 'K'),
  ('BCDFGHJL', 126, 'C', 'G', 'B', 'D', 'H', 'F', 'L', 'J'),
  ('BCDFGHKL', 125, 'C', 'G', 'B', 'D', 'H', 'F', 'L', 'K'),
  ('BCDFGIJK', 124, 'C', 'G', 'B', 'D', 'J', 'F', 'I', 'K'),
  ('BCDFGIJL', 123, 'C', 'G', 'B', 'D', 'J', 'F', 'L', 'I'),
  ('BCDFGIKL', 122, 'C', 'G', 'B', 'D', 'I', 'F', 'L', 'K'),
  ('BCDFGJKL', 121, 'C', 'G', 'B', 'D', 'J', 'F', 'L', 'K'),
  ('BCDFHIJK', 120, 'C', 'J', 'B', 'D', 'H', 'F', 'I', 'K'),
  ('BCDFHIJL', 119, 'C', 'J', 'B', 'D', 'H', 'F', 'L', 'I'),
  ('BCDFHIKL', 118, 'C', 'I', 'B', 'D', 'H', 'F', 'L', 'K'),
  ('BCDFHJKL', 117, 'C', 'J', 'B', 'D', 'H', 'F', 'L', 'K'),
  ('BCDFIJKL', 116, 'C', 'J', 'B', 'D', 'I', 'F', 'L', 'K'),
  ('BCDGHIJK', 115, 'H', 'G', 'B', 'C', 'J', 'D', 'I', 'K'),
  ('BCDGHIJL', 114, 'H', 'G', 'B', 'C', 'J', 'D', 'L', 'I'),
  ('BCDGHIKL', 113, 'H', 'G', 'B', 'C', 'I', 'D', 'L', 'K'),
  ('BCDGHJKL', 112, 'H', 'G', 'B', 'C', 'J', 'D', 'L', 'K'),
  ('BCDGIJKL', 111, 'I', 'G', 'B', 'C', 'J', 'D', 'L', 'K'),
  ('BCDHIJKL', 110, 'H', 'J', 'B', 'C', 'I', 'D', 'L', 'K'),
  ('BCEFGHIJ', 109, 'H', 'G', 'B', 'C', 'J', 'F', 'E', 'I'),
  ('BCEFGHIK', 108, 'E', 'G', 'B', 'C', 'H', 'F', 'I', 'K'),
  ('BCEFGHIL', 107, 'E', 'G', 'B', 'C', 'H', 'F', 'L', 'I'),
  ('BCEFGHJK', 106, 'H', 'G', 'B', 'C', 'J', 'F', 'E', 'K'),
  ('BCEFGHJL', 105, 'H', 'G', 'B', 'C', 'J', 'F', 'L', 'E'),
  ('BCEFGHKL', 104, 'E', 'G', 'B', 'C', 'H', 'F', 'L', 'K'),
  ('BCEFGIJK', 103, 'E', 'G', 'B', 'C', 'J', 'F', 'I', 'K'),
  ('BCEFGIJL', 102, 'E', 'G', 'B', 'C', 'J', 'F', 'L', 'I'),
  ('BCEFGIKL', 101, 'E', 'G', 'B', 'C', 'I', 'F', 'L', 'K'),
  ('BCEFGJKL', 100, 'E', 'G', 'B', 'C', 'J', 'F', 'L', 'K'),
  ('BCEFHIJK', 99, 'E', 'J', 'B', 'C', 'H', 'F', 'I', 'K'),
  ('BCEFHIJL', 98, 'E', 'J', 'B', 'C', 'H', 'F', 'L', 'I'),
  ('BCEFHIKL', 97, 'E', 'I', 'B', 'C', 'H', 'F', 'L', 'K'),
  ('BCEFHJKL', 96, 'E', 'J', 'B', 'C', 'H', 'F', 'L', 'K'),
  ('BCEFIJKL', 95, 'E', 'J', 'B', 'C', 'I', 'F', 'L', 'K'),
  ('BCEGHIJK', 94, 'E', 'J', 'B', 'C', 'H', 'G', 'I', 'K'),
  ('BCEGHIJL', 93, 'E', 'J', 'B', 'C', 'H', 'G', 'L', 'I'),
  ('BCEGHIKL', 92, 'E', 'G', 'B', 'C', 'I', 'H', 'L', 'K'),
  ('BCEGHJKL', 91, 'E', 'J', 'B', 'C', 'H', 'G', 'L', 'K'),
  ('BCEGIJKL', 90, 'E', 'J', 'B', 'C', 'I', 'G', 'L', 'K'),
  ('BCEHIJKL', 89, 'E', 'J', 'B', 'C', 'I', 'H', 'L', 'K'),
  ('BCFGHIJK', 88, 'H', 'G', 'B', 'C', 'J', 'F', 'I', 'K'),
  ('BCFGHIJL', 87, 'H', 'G', 'B', 'C', 'J', 'F', 'L', 'I'),
  ('BCFGHIKL', 86, 'H', 'G', 'B', 'C', 'I', 'F', 'L', 'K'),
  ('BCFGHJKL', 85, 'H', 'G', 'B', 'C', 'J', 'F', 'L', 'K'),
  ('BCFGIJKL', 84, 'I', 'G', 'B', 'C', 'J', 'F', 'L', 'K'),
  ('BCFHIJKL', 83, 'H', 'J', 'B', 'C', 'I', 'F', 'L', 'K'),
  ('BCGHIJKL', 82, 'H', 'J', 'B', 'C', 'I', 'G', 'L', 'K'),
  ('BDEFGHIJ', 81, 'H', 'G', 'B', 'D', 'J', 'F', 'E', 'I'),
  ('BDEFGHIK', 80, 'E', 'G', 'B', 'D', 'H', 'F', 'I', 'K'),
  ('BDEFGHIL', 79, 'E', 'G', 'B', 'D', 'H', 'F', 'L', 'I'),
  ('BDEFGHJK', 78, 'H', 'G', 'B', 'D', 'J', 'F', 'E', 'K'),
  ('BDEFGHJL', 77, 'H', 'G', 'B', 'D', 'J', 'F', 'L', 'E'),
  ('BDEFGHKL', 76, 'E', 'G', 'B', 'D', 'H', 'F', 'L', 'K'),
  ('BDEFGIJK', 75, 'E', 'G', 'B', 'D', 'J', 'F', 'I', 'K'),
  ('BDEFGIJL', 74, 'E', 'G', 'B', 'D', 'J', 'F', 'L', 'I'),
  ('BDEFGIKL', 73, 'E', 'G', 'B', 'D', 'I', 'F', 'L', 'K'),
  ('BDEFGJKL', 72, 'E', 'G', 'B', 'D', 'J', 'F', 'L', 'K'),
  ('BDEFHIJK', 71, 'E', 'J', 'B', 'D', 'H', 'F', 'I', 'K'),
  ('BDEFHIJL', 70, 'E', 'J', 'B', 'D', 'H', 'F', 'L', 'I'),
  ('BDEFHIKL', 69, 'E', 'I', 'B', 'D', 'H', 'F', 'L', 'K'),
  ('BDEFHJKL', 68, 'E', 'J', 'B', 'D', 'H', 'F', 'L', 'K'),
  ('BDEFIJKL', 67, 'E', 'J', 'B', 'D', 'I', 'F', 'L', 'K'),
  ('BDEGHIJK', 66, 'E', 'J', 'B', 'D', 'H', 'G', 'I', 'K'),
  ('BDEGHIJL', 65, 'E', 'J', 'B', 'D', 'H', 'G', 'L', 'I'),
  ('BDEGHIKL', 64, 'E', 'G', 'B', 'D', 'I', 'H', 'L', 'K'),
  ('BDEGHJKL', 63, 'E', 'J', 'B', 'D', 'H', 'G', 'L', 'K'),
  ('BDEGIJKL', 62, 'E', 'J', 'B', 'D', 'I', 'G', 'L', 'K'),
  ('BDEHIJKL', 61, 'E', 'J', 'B', 'D', 'I', 'H', 'L', 'K'),
  ('BDFGHIJK', 60, 'H', 'G', 'B', 'D', 'J', 'F', 'I', 'K'),
  ('BDFGHIJL', 59, 'H', 'G', 'B', 'D', 'J', 'F', 'L', 'I'),
  ('BDFGHIKL', 58, 'H', 'G', 'B', 'D', 'I', 'F', 'L', 'K'),
  ('BDFGHJKL', 57, 'H', 'G', 'B', 'D', 'J', 'F', 'L', 'K'),
  ('BDFGIJKL', 56, 'I', 'G', 'B', 'D', 'J', 'F', 'L', 'K'),
  ('BDFHIJKL', 55, 'H', 'J', 'B', 'D', 'I', 'F', 'L', 'K'),
  ('BDGHIJKL', 54, 'H', 'J', 'B', 'D', 'I', 'G', 'L', 'K'),
  ('BEFGHIJK', 53, 'E', 'J', 'B', 'F', 'H', 'G', 'I', 'K'),
  ('BEFGHIJL', 52, 'E', 'J', 'B', 'F', 'H', 'G', 'L', 'I'),
  ('BEFGHIKL', 51, 'E', 'G', 'B', 'F', 'I', 'H', 'L', 'K'),
  ('BEFGHJKL', 50, 'E', 'J', 'B', 'F', 'H', 'G', 'L', 'K'),
  ('BEFGIJKL', 49, 'E', 'J', 'B', 'F', 'I', 'G', 'L', 'K'),
  ('BEFHIJKL', 48, 'E', 'J', 'B', 'F', 'I', 'H', 'L', 'K'),
  ('BEGHIJKL', 47, 'E', 'J', 'I', 'B', 'H', 'G', 'L', 'K'),
  ('BFGHIJKL', 46, 'H', 'J', 'B', 'F', 'I', 'G', 'L', 'K'),
  ('CDEFGHIJ', 45, 'C', 'G', 'J', 'D', 'H', 'F', 'E', 'I'),
  ('CDEFGHIK', 44, 'C', 'G', 'E', 'D', 'H', 'F', 'I', 'K'),
  ('CDEFGHIL', 43, 'C', 'G', 'E', 'D', 'H', 'F', 'L', 'I'),
  ('CDEFGHJK', 42, 'C', 'G', 'J', 'D', 'H', 'F', 'E', 'K'),
  ('CDEFGHJL', 41, 'C', 'G', 'J', 'D', 'H', 'F', 'L', 'E'),
  ('CDEFGHKL', 40, 'C', 'G', 'E', 'D', 'H', 'F', 'L', 'K'),
  ('CDEFGIJK', 39, 'C', 'G', 'E', 'D', 'J', 'F', 'I', 'K'),
  ('CDEFGIJL', 38, 'C', 'G', 'E', 'D', 'J', 'F', 'L', 'I'),
  ('CDEFGIKL', 37, 'C', 'G', 'E', 'D', 'I', 'F', 'L', 'K'),
  ('CDEFGJKL', 36, 'C', 'G', 'E', 'D', 'J', 'F', 'L', 'K'),
  ('CDEFHIJK', 35, 'C', 'J', 'E', 'D', 'H', 'F', 'I', 'K'),
  ('CDEFHIJL', 34, 'C', 'J', 'E', 'D', 'H', 'F', 'L', 'I'),
  ('CDEFHIKL', 33, 'C', 'E', 'I', 'D', 'H', 'F', 'L', 'K'),
  ('CDEFHJKL', 32, 'C', 'J', 'E', 'D', 'H', 'F', 'L', 'K'),
  ('CDEFIJKL', 31, 'C', 'J', 'E', 'D', 'I', 'F', 'L', 'K'),
  ('CDEGHIJK', 30, 'E', 'G', 'J', 'C', 'H', 'D', 'I', 'K'),
  ('CDEGHIJL', 29, 'E', 'G', 'J', 'C', 'H', 'D', 'L', 'I'),
  ('CDEGHIKL', 28, 'E', 'G', 'I', 'C', 'H', 'D', 'L', 'K'),
  ('CDEGHJKL', 27, 'E', 'G', 'J', 'C', 'H', 'D', 'L', 'K'),
  ('CDEGIJKL', 26, 'E', 'G', 'I', 'C', 'J', 'D', 'L', 'K'),
  ('CDEHIJKL', 25, 'E', 'J', 'I', 'C', 'H', 'D', 'L', 'K'),
  ('CDFGHIJK', 24, 'C', 'G', 'J', 'D', 'H', 'F', 'I', 'K'),
  ('CDFGHIJL', 23, 'C', 'G', 'J', 'D', 'H', 'F', 'L', 'I'),
  ('CDFGHIKL', 22, 'C', 'G', 'I', 'D', 'H', 'F', 'L', 'K'),
  ('CDFGHJKL', 21, 'C', 'G', 'J', 'D', 'H', 'F', 'L', 'K'),
  ('CDFGIJKL', 20, 'C', 'G', 'I', 'D', 'J', 'F', 'L', 'K'),
  ('CDFHIJKL', 19, 'C', 'J', 'I', 'D', 'H', 'F', 'L', 'K'),
  ('CDGHIJKL', 18, 'H', 'G', 'I', 'C', 'J', 'D', 'L', 'K'),
  ('CEFGHIJK', 17, 'E', 'G', 'J', 'C', 'H', 'F', 'I', 'K'),
  ('CEFGHIJL', 16, 'E', 'G', 'J', 'C', 'H', 'F', 'L', 'I'),
  ('CEFGHIKL', 15, 'E', 'G', 'I', 'C', 'H', 'F', 'L', 'K'),
  ('CEFGHJKL', 14, 'E', 'G', 'J', 'C', 'H', 'F', 'L', 'K'),
  ('CEFGIJKL', 13, 'E', 'G', 'I', 'C', 'J', 'F', 'L', 'K'),
  ('CEFHIJKL', 12, 'E', 'J', 'I', 'C', 'H', 'F', 'L', 'K'),
  ('CEGHIJKL', 11, 'E', 'J', 'I', 'C', 'H', 'G', 'L', 'K'),
  ('CFGHIJKL', 10, 'H', 'G', 'I', 'C', 'J', 'F', 'L', 'K'),
  ('DEFGHIJK', 9, 'E', 'G', 'J', 'D', 'H', 'F', 'I', 'K'),
  ('DEFGHIJL', 8, 'E', 'G', 'J', 'D', 'H', 'F', 'L', 'I'),
  ('DEFGHIKL', 7, 'E', 'G', 'I', 'D', 'H', 'F', 'L', 'K'),
  ('DEFGHJKL', 6, 'E', 'G', 'J', 'D', 'H', 'F', 'L', 'K'),
  ('DEFGIJKL', 5, 'E', 'G', 'I', 'D', 'J', 'F', 'L', 'K'),
  ('DEFHIJKL', 4, 'E', 'J', 'I', 'D', 'H', 'F', 'L', 'K'),
  ('DEGHIJKL', 3, 'E', 'J', 'I', 'D', 'H', 'G', 'L', 'K'),
  ('DFGHIJKL', 2, 'H', 'G', 'I', 'D', 'J', 'F', 'L', 'K'),
  ('EFGHIJKL', 1, 'E', 'J', 'I', 'F', 'H', 'G', 'L', 'K')
on conflict (combination_key) do update set
  option_no = excluded.option_no,
  slot_1a = excluded.slot_1a,
  slot_1b = excluded.slot_1b,
  slot_1d = excluded.slot_1d,
  slot_1e = excluded.slot_1e,
  slot_1g = excluded.slot_1g,
  slot_1i = excluded.slot_1i,
  slot_1k = excluded.slot_1k,
  slot_1l = excluded.slot_1l;

alter table public.third_place_slot_options enable row level security;
drop policy if exists third_place_slot_options_select on public.third_place_slot_options;
create policy third_place_slot_options_select on public.third_place_slot_options
  for select to authenticated using (true);

-- FIFA group ranking inside one group: points, then head-to-head among teams tied
-- on points (points, goal difference, goals for), then overall GD/GF. Fair-play
-- and drawing of lots are not available in the app data model; the final fallback
-- remains deterministic by team code.
create or replace function public.group_rank(p_group text, p_pos int)
returns text language sql stable security definer set search_path = public as $$
  with st as (
    select * from public.compute_group_standings(p_group)
  ), ranked as (
    select s.*,
      coalesce(h.h2h_pts, 0) as h2h_pts,
      coalesce(h.h2h_gd, 0) as h2h_gd,
      coalesce(h.h2h_gf, 0) as h2h_gf
    from st s
    left join lateral (
      select
        coalesce(sum(case
          when m.home_code = s.code and m.home_score > m.away_score then 3
          when m.away_code = s.code and m.away_score > m.home_score then 3
          when (m.home_code = s.code or m.away_code = s.code) and m.home_score = m.away_score then 1
          else 0 end), 0)::int as h2h_pts,
        coalesce(sum(case
          when m.home_code = s.code then m.home_score - m.away_score
          when m.away_code = s.code then m.away_score - m.home_score
          else 0 end), 0)::int as h2h_gd,
        coalesce(sum(case
          when m.home_code = s.code then m.home_score
          when m.away_code = s.code then m.away_score
          else 0 end), 0)::int as h2h_gf
      from public.matches m
      where m.stage = 'group'
        and m.group_code = p_group
        and m.status = 'finished'
        and m.home_score is not null
        and m.away_score is not null
        and (m.home_code = s.code or m.away_code = s.code)
        and exists (
          select 1 from st o
          where o.code <> s.code
            and o.pts = s.pts
            and (o.code = m.home_code or o.code = m.away_code)
        )
    ) h on true
  )
  select code from ranked
  order by pts desc, h2h_pts desc, h2h_gd desc, h2h_gf desc, gd desc, gf desc, code asc
  offset greatest(p_pos - 1, 0) limit 1
$$;

create or replace function public.best_third_ranked()
returns table (group_code text, code text, pts int, gd int, gf int)
language sql stable security definer set search_path = public as $$
  with groups as (
    select distinct m.group_code
    from public.matches m
    where m.stage = 'group' and m.group_code is not null
  ), thirds as (
    select g.group_code, public.group_rank(g.group_code, 3) as code
    from groups g
  )
  select t.group_code, t.code, st.pts, st.gd, st.gf
  from thirds t
  join lateral (
    select pts, gd, gf from public.compute_group_standings(t.group_code) where code = t.code
  ) st on true
  where t.code is not null
  order by st.pts desc, st.gd desc, st.gf desc, t.group_code asc
  limit 8
$$;

create or replace function public.best_third_groups()
returns text[] language sql stable security definer set search_path = public as $$
  select array_agg(group_code order by pts desc, gd desc, gf desc, group_code asc)
  from public.best_third_ranked()
$$;

create or replace function public.best_third_codes()
returns text[] language sql stable security definer set search_path = public as $$
  select array_agg(code order by pts desc, gd desc, gf desc, group_code asc)
  from public.best_third_ranked()
$$;

create or replace function public.third_place_group_for_slot(p_slot text, p_groups text[])
returns text language plpgsql stable security definer set search_path = public as $$
declare v_key text; v_group text;
begin
  if array_length(p_groups, 1) is distinct from 8 then return null; end if;
  select string_agg(g, '' order by g) into v_key from unnest(p_groups) as u(g);

  select case upper(p_slot)
    when '1A' then slot_1a
    when '1B' then slot_1b
    when '1D' then slot_1d
    when '1E' then slot_1e
    when '1G' then slot_1g
    when '1I' then slot_1i
    when '1K' then slot_1k
    when '1L' then slot_1l
  end into v_group
  from public.third_place_slot_options
  where combination_key = v_key;

  return v_group;
end $$;

-- Official Round of 32 sources. B:<slot> means "best third-place group assigned
-- by Annex C to the group winner slot" (for example B:1E for 1E v 3A/B/C/D/F).
insert into public.knockout_slot_map (match_code, home_source, away_source) values
  ('ko-r32-1','R:A','R:B'),   -- Match 73: 2A v 2B
  ('ko-r32-2','W:E','B:1E'),  -- Match 74: 1E v 3A/B/C/D/F
  ('ko-r32-3','W:F','R:C'),   -- Match 75: 1F v 2C
  ('ko-r32-4','W:C','R:F'),   -- Match 76: 1C v 2F
  ('ko-r32-5','W:I','B:1I'),  -- Match 77: 1I v 3C/D/F/G/H
  ('ko-r32-6','R:E','R:I'),   -- Match 78: 2E v 2I
  ('ko-r32-7','W:A','B:1A'),  -- Match 79: 1A v 3C/E/F/H/I
  ('ko-r32-8','W:L','B:1L'),  -- Match 80: 1L v 3E/H/I/J/K
  ('ko-r32-9','W:D','B:1D'),  -- Match 81: 1D v 3B/E/F/I/J
  ('ko-r32-10','W:G','B:1G'), -- Match 82: 1G v 3A/E/H/I/J
  ('ko-r32-11','R:K','R:L'),  -- Match 83: 2K v 2L
  ('ko-r32-12','W:H','R:J'),  -- Match 84: 1H v 2J
  ('ko-r32-13','W:B','B:1B'), -- Match 85: 1B v 3E/F/G/I/J
  ('ko-r32-14','W:J','R:H'),  -- Match 86: 1J v 2H
  ('ko-r32-15','W:K','B:1K'), -- Match 87: 1K v 3D/E/I/J/L
  ('ko-r32-16','R:D','R:G')   -- Match 88: 2D v 2G
on conflict (match_code) do update set home_source=excluded.home_source, away_source=excluded.away_source;

drop function if exists public.resolve_ko_source(text,text[]);
create function public.resolve_ko_source(p_source text, p_third_groups text[])
returns text language plpgsql stable security definer set search_path = public as $$
declare kind text := split_part(p_source,':',1); arg text := split_part(p_source,':',2); grp_done boolean; third_group text;
begin
  if kind = 'B' then
    third_group := public.third_place_group_for_slot(arg, p_third_groups);
    if third_group is null then return null; end if;
    return public.group_rank(third_group, 3);
  end if;

  select bool_and(status='finished') into grp_done from public.matches where stage='group' and group_code=arg;
  if not coalesce(grp_done,false) then return null; end if;
  if kind='W' then return public.group_rank(arg,1); end if;
  if kind='R' then return public.group_rank(arg,2); end if;
  return null;
end $$;
revoke execute on function public.resolve_ko_source(text,text[]) from public, anon, authenticated;

create or replace function public.materialize_knockout()
returns integer language plpgsql security definer set search_path = public as $$
declare v_third_groups text[]; r record; v_home text; v_away text; v_count int := 0;
begin
  if (select bool_and(status='finished') from public.matches where stage='group') then
    v_third_groups := public.best_third_groups();
  end if;
  for r in select * from public.knockout_slot_map loop
    if exists (select 1 from public.matches m where m.match_code=r.match_code
               and (coalesce(m.home_code,'TBD')='TBD' or coalesce(m.away_code,'TBD')='TBD')
               and coalesce(m.lock_reason,'') <> 'admin_lock') then
      v_home := public.resolve_ko_source(r.home_source, v_third_groups);
      v_away := public.resolve_ko_source(r.away_source, v_third_groups);
      if v_home is not null and v_away is not null and v_home <> v_away then
        perform public._ko_fill(r.match_code, v_home, v_away);
        v_count := v_count + 1;
      end if;
    end if;
  end loop;
  if v_count>0 then perform public.log_audit('knockout_materialized','match','r32',null,jsonb_build_object('slots_filled',v_count)); end if;
  return v_count;
end $$;
revoke execute on function public.materialize_knockout() from public, anon, authenticated;

-- Official progression by FIFA match number: 89=(74,77), 90=(73,75), etc.
insert into public.knockout_progression (target_match, home_src, home_take, away_src, away_take) values
  ('ko-r16-1','ko-r32-2','winner','ko-r32-5','winner'),
  ('ko-r16-2','ko-r32-1','winner','ko-r32-3','winner'),
  ('ko-r16-3','ko-r32-4','winner','ko-r32-6','winner'),
  ('ko-r16-4','ko-r32-7','winner','ko-r32-8','winner'),
  ('ko-r16-5','ko-r32-11','winner','ko-r32-12','winner'),
  ('ko-r16-6','ko-r32-9','winner','ko-r32-10','winner'),
  ('ko-r16-7','ko-r32-14','winner','ko-r32-16','winner'),
  ('ko-r16-8','ko-r32-13','winner','ko-r32-15','winner'),
  ('ko-qf-1','ko-r16-1','winner','ko-r16-2','winner'),
  ('ko-qf-2','ko-r16-5','winner','ko-r16-6','winner'),
  ('ko-qf-3','ko-r16-3','winner','ko-r16-4','winner'),
  ('ko-qf-4','ko-r16-7','winner','ko-r16-8','winner'),
  ('ko-sf-1','ko-qf-1','winner','ko-qf-2','winner'),
  ('ko-sf-2','ko-qf-3','winner','ko-qf-4','winner'),
  ('ko-final-1','ko-sf-1','winner','ko-sf-2','winner'),
  ('ko-third-1','ko-sf-1','loser','ko-sf-2','loser')
on conflict (target_match) do update set
  home_src=excluded.home_src, home_take=excluded.home_take,
  away_src=excluded.away_src, away_take=excluded.away_take;
