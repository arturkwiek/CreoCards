-- Etap „Grafik”: nowy status alergii „nieuzupełnione” (klientka dodana przy rezerwacji terminu, np. przez telefon).
-- Osobny plik: nowej wartości typu wyliczeniowego nie można użyć w tej samej transakcji, w której ją dodano.
-- Migracja addytywna (nowa wartość typu).

alter type public.allergy_status add value if not exists 'unknown';

comment on type public.allergy_status is
  'none = brak znanych alergii, has = są alergie / uwagi zdrowotne, unknown = nieuzupełnione (zapytać przed nałożeniem farby)';
