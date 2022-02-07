import React, { useState, useEffect } from 'react';
import csv from 'csvtojson';
import Analytics from '../components/analytics';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Heading,
  Image,
  Popover,
  Menu,
  Button,
  Position,
  Pane,
  SelectMenu,
} from 'evergreen-ui';

export default function Home(props) {
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
      <Pane
        display="flex"
        justifyContent="flex-end"
        marginX={!phone ? 64 : undefined}
        marginTop={phone ? 16 : undefined}
      >
        {/* <Popover
          position={Position.BOTTOM_RIGHT}
          content={
            <Menu>
              {props.dates.map(date => (
                <Menu.Item
                  key={date}
                  onSelect={() => router.push(`/archive/${date}`)}
                >
                  {date}
                </Menu.Item>
              ))}
            </Menu>
          }
        >
          <Button marginRight={16}>Archiv</Button>
        </Popover> */}
        <SelectMenu
          title="Select"
          options={props.dates.map(date => ({ label: date, value: date }))}
          selected={null}
          hasFilter={false}
          hasTitle={false}
          onSelect={date => router.push(`/archive/${date.value}`)}
        >
          <Button marginRight={16}>Archiv</Button>
        </SelectMenu>
      </Pane>
      <Analytics {...props} phone={phone} />;
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

  const dates = fs.readdirSync('data/historic');

  return {
    props: {
      aggData,
      projectionOmicronGrowth,
      projectionBa1Growth,
      projectionBa2Growth,
      sdps,
      projection,
      dates,
    },
  };
}
