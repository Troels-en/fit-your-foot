-- Replace alle shoes.image_url mit funktionierenden URLs.
-- Vorher: keller-sports.de CDN, blocked Hot-Linking (alle 403).
-- Jetzt: cdn.runrepeat.com, hot-link-friendly, 200 + image/*.
-- Special: reebok-floatride-energy-6 fällt auf v5-Image zurück (v6 nicht auf RR).

UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40838/adidas-adistar-4-24644201-720.jpg' WHERE slug = 'adidas-adistar-4';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40584/adidas-adizero-adios-pro-4-22483965-720.jpg' WHERE slug = 'adidas-adizero-adios-pro-4';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40797/adidas-adizero-boston-13-23048569-720.jpg' WHERE slug = 'adidas-adizero-boston-13';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40586/adidas-adizero-evo-sl-22256345-720.jpg' WHERE slug = 'adidas-adizero-evo-sl';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40637/adidas-supernova-rise-2-22781441-720.jpg' WHERE slug = 'adidas-supernova-rise-2';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/37944/adidas-ultraboost-22-21173726-720.jpg' WHERE slug = 'adidas-ultraboost-22';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40462/adidas-ultraboost-5-21818110-720.jpg' WHERE slug = 'adidas-ultraboost-5';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40449/adidas-ultraboost-5-x-22499466-720.jpg' WHERE slug = 'adidas-ultraboost-5x';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/38176/asics-gel-1130-21196676-720.jpg' WHERE slug = 'asics-gel-1130';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40013/asics-gel-kayano-30-21161600-720.jpg' WHERE slug = 'asics-gel-kayano-30';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40809/asics-gel-kayano-32-23240127-720.jpg' WHERE slug = 'asics-gel-kayano-32';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/41074/asics-gel-nimbus-28-24039655-720.jpg' WHERE slug = 'asics-gel-nimbus-28';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40608/asics-novablast-5-22312736-720.jpg' WHERE slug = 'asics-novablast-5';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40450/asics-superblast-2-21749161-720.jpg' WHERE slug = 'asics-superblast-2';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40538/brooks-adrenaline-gts-24-2-22723083-720.jpg' WHERE slug = 'brooks-adrenaline-gts-24';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40307/brooks-ghost-16-21769307-720.jpg' WHERE slug = 'brooks-ghost-16';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40767/brooks-ghost-17-23734399-720.jpg' WHERE slug = 'brooks-ghost-17';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40935/brooks-ghost-max-3-23740532-720.jpg' WHERE slug = 'brooks-ghost-max-3';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/38861/hoka-bondi-8-21232045-720.jpg' WHERE slug = 'hoka-bondi-8';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40639/hoka-bondi-9-22560581-720.jpg' WHERE slug = 'hoka-bondi-9';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40691/hoka-clifton-10-22918659-720.jpg' WHERE slug = 'hoka-clifton-10';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40333/hoka-mach-6-21454844-720.jpg' WHERE slug = 'hoka-mach-6';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/39688/hoka-speedgoat-6-21660912-720.jpg' WHERE slug = 'hoka-speedgoat-6';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40457/hoka-tecton-x-3-22615639-720.jpg' WHERE slug = 'hoka-tecton-x-3';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40828/mizuno-neo-vista-2-23266001-720.jpg' WHERE slug = 'mizuno-neo-vista-2';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/39992/mizuno-wave-rider-27-21208144-720.jpg' WHERE slug = 'mizuno-wave-rider-27';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/39575/new-balance-990-v-6-21208156-720.jpg' WHERE slug = 'nb-990v6';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40532/new-balance-fresh-foam-x-1080-v-14-22470928-720.jpg' WHERE slug = 'nb-fresh-foam-1080-v14';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40390/nike-pegasus-41-21635997-720.jpg' WHERE slug = 'nike-pegasus-41';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40633/nike-pegasus-premium-23005570-720.jpg' WHERE slug = 'nike-pegasus-premium';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40754/nike-vaporfly-4-22860848-720.jpg' WHERE slug = 'nike-vaporfly-4';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40615/nike-vomero-18-23005571-720.jpg' WHERE slug = 'nike-vomero-18';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40912/nike-vomero-plus-23479827-720.jpg' WHERE slug = 'nike-vomero-plus';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/41011/nike-vomero-premium-23709495-720.jpg' WHERE slug = 'nike-vomero-premium';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/38614/on-cloud-5-21237205-720.jpg' WHERE slug = 'on-cloud-5';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/38404/on-cloudmonster-21237207-720.jpg' WHERE slug = 'on-cloudmonster';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/41233/on-cloudmonster-3-24670501-720.jpg' WHERE slug = 'on-cloudmonster-3';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40936/on-cloudsurfer-max-23703748-720.jpg' WHERE slug = 'on-cloudsurfer-max';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40788/puma-fast-r-nitro-elite-3-23761980-720.jpg' WHERE slug = 'puma-fast-r-nitro-elite-3';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40300/puma-velocity-nitro-3-21383733-720.jpg' WHERE slug = 'puma-velocity-nitro-3';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/38918/salomon-speedcross-6-21230510-720.jpg' WHERE slug = 'salomon-speedcross-6';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/41067/saucony-endorphin-pro-5-24665925-720.jpg' WHERE slug = 'saucony-endorphin-pro-5';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40830/saucony-endorphin-speed-5-23261039-720.jpg' WHERE slug = 'saucony-endorphin-speed-5';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40921/saucony-hurricane-25-23715760-720.jpg' WHERE slug = 'saucony-hurricane-25';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40428/saucony-kinvara-15-21929783-720.jpg' WHERE slug = 'saucony-kinvara-15';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40236/saucony-ride-17-21258652-720.jpg' WHERE slug = 'saucony-ride-17';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40384/adidas-adizero-sl-2-21915926-720.jpg' WHERE slug = 'adidas-adizero-sl2';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40120/nike-infinity-rn-4-21212249-720.jpg' WHERE slug = 'nike-react-infinity-run-4';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/40230/on-cloudflow-4-21216739-720.jpg' WHERE slug = 'on-cloudflow-4';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/41066/new-balance-1080-v-15-24327575-720.jpg' WHERE slug = 'nb-fresh-foam-1080-v15';
UPDATE public.shoes SET image_url = 'https://cdn.runrepeat.com/storage/gallery/product_primary/39691/reebok-floatride-energy-5-21226086-720.jpg' WHERE slug = 'reebok-floatride-energy-6';
