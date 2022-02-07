import React from 'react';
import csv from 'csvtojson';
import Analytics from '../components/analytics';
import Head from 'next/head';
import { Heading, Image } from 'evergreen-ui';

export default function Home(props) {
  return (
    <>
      <Head>
        <title>Omikron Tracker</title>
      </Head>
      <Heading
        is="h1"
        display="flex"
        justifyContent="center"
        alignItems="center"
        size={900}
        marginTop={32}
      >
        <Image src="/icon-512x512.png" width={42} height={42} alt="Logo" />
        <span style={{ display: 'inline-block', marginLeft: '1rem' }}>
          {' '}
          Omikron Tracker
        </span>
      </Heading>
      <Analytics {...props} />;
    </>
  );
}

export async function getStaticProps(context) {
  const fs = require('fs');

  const readCsv = async filename =>
    await csv({ checkType: true }).fromFile(filename);

  const aggData = await readCsv('data/agg_data.csv');
  const projection = await readCsv('data/projection.csv');
  //const aggDataRolling = await readCsv('data/agg_data_rolling.csv');
  const projectionOmicronGrowth = await readCsv('data/growth_fit/omicron.csv');
  const projectionBa1Growth = await readCsv('data/growth_fit/ba1.csv');
  const projectionBa2Growth = await readCsv('data/growth_fit/ba2.csv');
  const sdps = await JSON.parse(fs.readFileSync('data/sdps.json'));

  return {
    props: {
      aggData,
      projectionOmicronGrowth,
      projectionBa1Growth,
      projectionBa2Growth,
      sdps,
      projection,
    },
  };
}
