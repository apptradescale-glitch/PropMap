import { Helmet } from 'react-helmet-async';
import React from 'react';

export default function PageHead({ title = 'Tradescale' }) {
  return (
    <Helmet>
      <title> {title} </title>
    </Helmet>
  );
}
