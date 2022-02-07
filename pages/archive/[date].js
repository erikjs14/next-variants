import React, { useState, useEffect } from 'react';
import csv from 'csvtojson';
import Analytics from '../../components/analytics';
import {
  Heading,
  Image,
  Pane,
  Alert,
  Text,
  Button,
  UndoIcon,
  SelectMenu,
} from 'evergreen-ui';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Archive(props) {
  const router = useRouter();

  const [phone, setPhone] = useState(false);
  useEffect(() => {
    setPhone(window.matchMedia('(max-width: 768px)').matches);
    window
      .matchMedia('(max-width: 768px)')
      .addEventListener('change', e => setPhone(e.matches));
  }, []);

  return (
    <>
      <Head>
        <title>Omikron Tracker - {props.archiveDate}</title>
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
      <Pane
        display="flex"
        justifyContent="center"
        alignItems="center"
        marginX={4}
        marginTop={32}
      >
        <Alert
          intent="none"
          title="Diese Seite ist eine Archivseite"
          paddingRight={64}
        >
          <Text>
            Hier werden die Daten angezeigt, wie vom {props.archiveDate}.
          </Text>
        </Alert>
      </Pane>
      <Pane
        marginBottom={phone ? -16 : -32}
        marginTop={16}
        display="flex"
        justifyContent="space-between"
        marginX={!phone ? 64 : undefined}
      >
        <Button iconBefore={UndoIcon} onClick={() => router.push('/')}>
          Zurück zu Heute
        </Button>
        <SelectMenu
          title="Select"
          options={props.dates.map(date => ({ label: date, value: date }))}
          selected={props.archiveDate}
          hasFilter={false}
          hasTitle={false}
          onSelect={date => router.push(`/archive/${date.value}`)}
        >
          <Button marginRight={16}>Archiv</Button>
        </SelectMenu>
      </Pane>
      <Analytics {...props} archive={props.archiveDate} phone={phone} />;
    </>
  );
}

export async function getStaticPaths() {
  const fs = require('fs');
  const dates = fs.readdirSync('data/historic');
  return {
    paths: dates.map(date => ({
      params: { date },
    })),
    fallback: false,
  };
}

export async function getStaticProps(context) {
  const fs = require('fs');

  const readCsv = async filename =>
    await csv({ checkType: true }).fromFile(filename);

  const aggData = await readCsv(
    `data/historic/${context.params.date}/agg_data.csv`,
  );
  const projection = await readCsv(
    `data/historic/${context.params.date}/projection.csv`,
  );
  //const aggDataRolling = await readCsv(`data/historic/${context.params.date}/agg_data_rolling.csv`);
  const projectionOmicronGrowth = await readCsv(
    `data/historic/${context.params.date}/growth_fit/omicron.csv`,
  );
  const projectionBa1Growth = await readCsv(
    `data/historic/${context.params.date}/growth_fit/ba1.csv`,
  );
  const projectionBa2Growth = await readCsv(
    `data/historic/${context.params.date}/growth_fit/ba2.csv`,
  );
  const sdps = await JSON.parse(
    fs.readFileSync(`data/historic/${context.params.date}/sdps.json`),
  );

  const dates = fs.readdirSync('data/historic');

  return {
    props: {
      aggData,
      projectionOmicronGrowth,
      projectionBa1Growth,
      projectionBa2Growth,
      sdps,
      projection,
      archiveDate: context.params.date,
      dates,
    },
  };
}
