UPDATE public.shoes
SET image_url = CASE slug
  WHEN 'nike-vaporfly-4' THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nike-pegasus-41' THEN 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nike-pegasus-premium' THEN 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nike-react-infinity-run-4' THEN 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nike-vomero-18' THEN 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nike-vomero-plus' THEN 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nike-vomero-premium' THEN 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=1200&q=80'

  WHEN 'nb-990v6' THEN 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nb-fresh-foam-1080-v15' THEN 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80'
  WHEN 'nb-fresh-foam-1080-v14' THEN 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80'

  WHEN 'hoka-bondi-8' THEN 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80'
  WHEN 'hoka-bondi-9' THEN 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=1200&q=80'
  WHEN 'hoka-clifton-10' THEN 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80'
  WHEN 'hoka-mach-6' THEN 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80'
  WHEN 'hoka-speedgoat-6' THEN 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80'
  WHEN 'hoka-tecton-x-3' THEN 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80'

  WHEN 'asics-gel-1130' THEN 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80'
  WHEN 'asics-gel-kayano-30' THEN 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=1200&q=80'
  WHEN 'asics-gel-kayano-32' THEN 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80'
  WHEN 'asics-gel-nimbus-28' THEN 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80'
  WHEN 'asics-novablast-5' THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'
  WHEN 'asics-superblast-2' THEN 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80'

  WHEN 'brooks-adrenaline-gts-24' THEN 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80'
  WHEN 'brooks-ghost-16' THEN 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80'
  WHEN 'brooks-ghost-17' THEN 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80'
  WHEN 'brooks-ghost-max-3' THEN 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=80'

  WHEN 'on-cloud-5' THEN 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80'
  WHEN 'on-cloudflow-4' THEN 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80'
  WHEN 'on-cloudmonster' THEN 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=1200&q=80'
  WHEN 'on-cloudmonster-3' THEN 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80'
  WHEN 'on-cloudsurfer-max' THEN 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80'

  WHEN 'adidas-adistar-4' THEN 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-adizero-adios-pro-4' THEN 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-adizero-boston-13' THEN 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-adizero-evo-sl' THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-adizero-sl2' THEN 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-supernova-rise-2' THEN 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-ultraboost-22' THEN 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-ultraboost-5' THEN 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80'
  WHEN 'adidas-ultraboost-5x' THEN 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80'

  WHEN 'saucony-endorphin-pro-5' THEN 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80'
  WHEN 'saucony-endorphin-speed-5' THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'
  WHEN 'saucony-hurricane-25' THEN 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80'
  WHEN 'saucony-kinvara-15' THEN 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80'
  WHEN 'saucony-ride-17' THEN 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80'

  WHEN 'mizuno-neo-vista-2' THEN 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80'
  WHEN 'mizuno-wave-rider-27' THEN 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80'
  WHEN 'puma-fast-r-nitro-elite-3' THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'
  WHEN 'puma-velocity-nitro-3' THEN 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=80'
  WHEN 'reebok-floatride-energy-6' THEN 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80'
  WHEN 'salomon-speedcross-6' THEN 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80'
  ELSE image_url
END
WHERE image_url IS NULL OR image_url = '' OR image_url LIKE '%photo-1542291026-7eec264c27ff%';