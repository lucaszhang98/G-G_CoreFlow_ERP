-- Rename carrier "G&G" to "GG" (name and carrier_code) so pickup management options and import use "GG"
UPDATE public.carriers
SET name = 'GG', carrier_code = 'GG', updated_at = now()
WHERE name = 'G&G' OR carrier_code = 'G&G';
