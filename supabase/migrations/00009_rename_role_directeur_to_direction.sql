-- Migration: Renommer le rôle "directeur" en "direction"
UPDATE entreprise_membres
  SET roles = array_replace(roles, 'directeur', 'direction')
  WHERE 'directeur' = ANY(roles);
