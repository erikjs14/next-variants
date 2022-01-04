import React, { useState, useMemo } from 'react';
import {
  Card,
  Heading,
  Pane,
  Switch,
  Text,
  Tooltip,
  InfoSignIcon,
  Tablist,
  Tab,
  Checkbox,
} from 'evergreen-ui';
import csv from 'csvtojson';
import {
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip as ChartTooltip,
} from 'recharts';

export default function Home(props) {
  const [ogcLogit, setOgcLogit] = useState(false);
  const [ogcFit, setOgcFit] = useState(false);

  const [accForecastDays, setAccForecastDays] = useState(14);
  const [accShowActualCases, setAccShowActualCases] = useState(true);

  const ogcData = useMemo(
    () =>
      props.aggData
        .filter(
          d =>
            d.sum >= 10 &&
            new Date(d.date).getTime() >= new Date('2021-11-15').getTime() &&
            d.omicron_rel > 0,
        )
        .concat(
          ogcFit
            ? props.projectionOmicronGrowth.filter(
                d =>
                  new Date(d.date).getTime() >=
                  new Date(
                    props.aggData[props.aggData.length - 1].date,
                  ).getTime(),
              )
            : [],
        )
        .map(d => ({
          date: d.date,
          omicron_rel: d.omicron_rel,
          sum: d.sum,
          fit:
            d.fit ||
            props.projectionOmicronGrowth.find(p => p.date === d.date)?.fit,
        })),
    [ogcFit, props.aggData, props.projectionOmicronGrowth],
  );

  const accData = useMemo(
    () =>
      props.projection
        .slice(0, props.projection.length - (28 - accForecastDays))
        .map(d => ({
          date: d.date,
          omicron_abs: d.omicron_abs || undefined,
          delta_abs: d.delta_abs || undefined,
          omicron_abs_fit: d.omicron_abs_fit,
          delta_abs_fit: d.delta_abs_fit,
          new_cases_smoothed_fit: d.new_cases_smoothed_fit,
          new_cases_smoothed: d.new_cases_smoothed || undefined,
        })),
    [accForecastDays, props.projection],
  );

  return (
    <Pane marginTop={32}>
      <Heading is="h1" textAlign="center" size={900}>
        Omikron Tracker
      </Heading>

      {/* Omicron Growth Chart (OGC) */}
      <Card elevation={3} padding={16} paddingX={32} margin={64}>
        <Heading textAlign="center" size="500" marginBottom={32}>
          Omikron Fälle
        </Heading>

        <Pane display="flex" justifyContent="flex-end">
          <Text display="flex" alignItems="center" justifyContent="flex-end">
            Linear
            <Switch
              checked={ogcLogit}
              onChange={e => setOgcLogit(e.target.checked)}
              marginX={8}
              display="inline-block"
            />
            Log
          </Text>
          <Text
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            marginLeft={32}
          >
            Bis Heute
            <Switch
              checked={ogcFit}
              onChange={e => setOgcFit(e.target.checked)}
              marginX={8}
              display="inline-block"
            />
            Projektion
          </Text>
        </Pane>

        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart
            width={800}
            height={500}
            margin={{
              top: 20,
              right: 20,
              bottom: 20,
              left: 20,
            }}
            data={ogcData}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              dataKey="omicron_rel"
              scale={ogcLogit ? 'log' : 'linear'}
              domain={
                ogcLogit ? [dataMin => dataMin - 0.5 * dataMin, 1] : [-0.1, 1]
              }
              allowDataOverflow
              ticks={ogcLogit ? [0.01, 0.1, 0.5, 0.9, 0.99, 1] : []}
            />
            <ZAxis dataKey="sum" type="number" range={[30, 200]} />
            <ChartTooltip />
            <Scatter dataKey="omicron_rel" fill="#8884d8" />
            <Line dataKey="fit" dot={false} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Absolute Case Chart */}
      <Card elevation={3} padding={16} paddingX={32} margin={64}>
        <Heading textAlign="center" size="500" marginBottom={32}>
          Absoloute Fälle [pro Tag]
        </Heading>

        <Pane display="flex" justifyContent="flex-end" alignItems="center">
          <Text marginRight={16}>Projektion [Tage]</Text>
          <Tablist>
            {[0, 7, 14, 21, 28].map(days => (
              <Tab
                key={days}
                id={days}
                onSelect={() => setAccForecastDays(days)}
                isSelected={days === accForecastDays}
              >
                {days}
              </Tab>
            ))}
          </Tablist>
        </Pane>

        <Pane display="flex" justifyContent="flex-end" alignItems="center">
          <Checkbox
            checked={accShowActualCases}
            onChange={e => setAccShowActualCases(e.target.checked)}
          />
          <Text marginLeft={16}>Tatsächlich gemeldete Fallzahlen</Text>
        </Pane>

        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart
            width={800}
            height={500}
            margin={{
              top: 20,
              right: 20,
              bottom: 20,
              left: 20,
            }}
            data={accData}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <ChartTooltip />
            <Scatter dataKey="omicron_abs" fill="#2f00c9" />
            <Scatter dataKey="delta_abs" fill="#dbbe00" />
            {accShowActualCases && (
              <Scatter dataKey="new_cases_smoothed" fill="#700036" />
            )}
            <Line
              dataKey="omicron_abs_fit"
              dot={false}
              activeDot={false}
              stroke="#2f00c9"
            />
            <Line
              dataKey="delta_abs_fit"
              dot={false}
              activeDot={false}
              stroke="#505c00"
            />
            <Line
              dataKey="new_cases_smoothed_fit"
              dot={false}
              activeDot={false}
              strokeWidth={3}
              stroke="#700036"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card elevation={3} padding={16} paddingX={32} margin={64}>
        <Heading textAlign="center" size="500" marginBottom={32}>
          Bullets
        </Heading>

        <Pane
          display="flex"
          justifyContent="space-evenly"
          alignItems="center"
          flexWrap="wrap"
        >
          {props.sdps.map(sdp => (
            <Card
              key={sdp.label}
              elevation={1}
              paddingX={16}
              paddingY={8}
              display="flex"
              flexDirection="column"
              alignItems="center"
              flexBasis="26%"
              position="relative"
              marginBottom={8}
            >
              <Heading
                is="h4"
                textAlign="center"
                size={500}
                fontWeight="normal"
              >
                {sdp.label}
              </Heading>
              <Heading is="span" marginY={16} size={900}>
                {sdp.value}
              </Heading>
              <Tooltip content={sdp.hint}>
                <InfoSignIcon
                  size={12}
                  position="absolute"
                  top="50%"
                  right={14}
                  transform="translateY(-50%)"
                />
              </Tooltip>
            </Card>
          ))}
        </Pane>
      </Card>
    </Pane>
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
  const sdps = await JSON.parse(fs.readFileSync('data/sdps.json'));

  return {
    props: { aggData, projectionOmicronGrowth, sdps, projection },
  };
}
