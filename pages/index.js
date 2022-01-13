/* eslint-disable react/display-name */
import React, { useState, useMemo, useEffect } from 'react';
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
  Paragraph,
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
  Legend,
  ReferenceLine,
} from 'recharts';
import Image from 'next/image';

export default function Home(props) {
  const [ogcLogit, setOgcLogit] = useState(false);
  const [ogcFit, setOgcFit] = useState(false);

  const [accForecastDays, setAccForecastDays] = useState(14);
  const [accShowActualCases, setAccShowActualCases] = useState(true);

  const [phone, setPhone] = useState(false);
  useEffect(() => {
    setPhone(window.matchMedia('(max-width: 768px)').matches);
    window
      .matchMedia('(max-width: 768px)')
      .addEventListener('change', e => setPhone(e.matches));
  }, []);

  const [todayStr, setTodayStr] = useState(null);
  useEffect(() => {
    const d = new Date();
    setTodayStr(
      d.getFullYear() +
        '-' +
        (d.getMonth() + 1).toString().padStart(2, '0') +
        '-' +
        d.getDate().toString().padStart(2, '0'),
    );
  }, []);

  const ogcData = useMemo(
    () =>
      props.aggData
        .filter(
          d =>
            new Date(d.date).getTime() >= new Date('2021-11-15').getTime() &&
            d.omicron_rel > 0,
        )
        .concat(
          ogcFit
            ? props.projectionOmicronGrowth.filter(
                d =>
                  new Date(d.date).getTime() >
                  new Date(
                    props.aggData[props.aggData.length - 1].date,
                  ).getTime(),
              )
            : props.projectionOmicronGrowth.filter(
                d =>
                  new Date(d.date).getTime() >
                    new Date(
                      props.aggData[props.aggData.length - 1].date,
                    ).getTime() &&
                  new Date(d.date).getTime() <= new Date().getTime(),
              ),
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
  const ogcLabelMap = useMemo(
    () => ({
      date: 'Datum',
      omicron_rel: 'Omikron [relativ]',
      sum: 'Anzahl Sequenzierungen',
      fit: 'Modelliertes Wachstum',
    }),
    [],
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
  const accLabelMap = useMemo(
    () => ({
      date: 'Datum',
      omicron_abs: 'Omikron [tatsächlich, absolut]',
      delta_abs: 'Delta [tatsächlich, absolut]',
      omicron_abs_fit: 'Omikron [modelliert, absolut]',
      delta_abs_fit: 'Delta [modelliert, absolut]',
      new_cases_smoothed:
        '7-Tage Mittel tägl. Neuinfektionen [tatsächlich, absolut]',
      new_cases_smoothed_fit:
        '7-Tage Mittel tägl. Neuinfektionen [modelliert, absolut]',
    }),
    [],
  );
  const [accOpacity, setAccOpacity] = useState(
    (() => {
      const init = {};
      for (let key of Object.keys(accLabelMap)) {
        init[key] = 1;
      }
      return init;
    })(),
  );
  const handleMouseEnter = o => {
    setAccOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 0.5 : 0.1,
    }));
  };
  const handleMouseLeave = o => {
    setAccOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 1 : 0.1,
    }));
  };
  const handleClick = o => {
    setAccOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 0.1 : 0.5,
    }));
  };

  const CustomTooltip =
    type =>
    ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        let pl = payload;
        if (type === 'ogc') {
          const plOr = payload.find(p => p.dataKey === 'omicron_rel');
          if (plOr) {
            pl = payload.concat({
              color: plOr.color,
              name: 'sum',
              value: plOr.payload.sum,
              noDec: true,
            });
          }
        }
        const labelMap =
          type === 'ogc' ? ogcLabelMap : type === 'acc' ? accLabelMap : {};
        return (
          <Pane
            backgroundColor="#fff"
            border="1px solid #bbb"
            borderRadius={4}
            padding={4}
            maxWidth="80vw"
          >
            <Heading size={400} marginBottom={4}>
              {label}
            </Heading>
            {pl.map(d => (
              <Pane
                key={d.name}
                display="flex"
                justifyContent="space-between"
                color={d.color}
              >
                <Text color="inherit">{labelMap[d.name] || d.name}:</Text>
                <Text color="inherit" marginLeft={16} fontFamily="mono">
                  {d.value.toFixed(d.noDec ? 0 : type === 'ogc' ? 6 : 2)}
                </Text>
              </Pane>
            ))}
          </Pane>
        );
      }

      return null;
    };

  return (
    <Pane marginTop={32}>
      <Heading
        is="h1"
        display="flex"
        justifyContent="center"
        alignItems="center"
        size={900}
      >
        <Image src="/icon-512x512.png" width={42} height={42} alt="Logo" />
        <span style={{ display: 'inline-block', marginLeft: '1rem' }}>
          {' '}
          Omikron Tracker
        </span>
      </Heading>

      {/* Omicron Growth Chart (OGC) */}
      <Card
        elevation={3}
        paddingY={16}
        paddingX={phone ? 4 : 32}
        margin={!phone ? 64 : undefined}
        marginY={phone ? 32 : 64}
        paddingBottom={phone ? 32 : 16}
      >
        <Heading textAlign="center" size={500} marginBottom={32}>
          Omikron Fälle [rel]
        </Heading>

        <Pane
          display="flex"
          justifyContent={'flex-end'}
          alignItems={'center'}
          flexDirection={phone ? 'column' : 'row'}
        >
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
            marginTop={phone ? 8 : undefined}
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

        <ResponsiveContainer width="100%" height={phone ? 400 : 500}>
          <ComposedChart
            width={1000}
            height={phone ? 400 : 500}
            margin={{
              top: 20,
              right: 10,
              bottom: 20,
              left: 0,
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
            <ZAxis
              dataKey="sum"
              type="number"
              range={phone ? [10, 80] : [30, 200]}
            />
            <ChartTooltip content={CustomTooltip('ogc')} />
            <Legend
              layout={phone ? 'vertical' : 'horizontal'}
              align="center"
              verticalAlign="bottom"
              wrapperStyle={{
                position: 'relative',
                paddingLeft: phone ? 30 : undefined,
              }}
              formatter={val => {
                return <Text color="inherit">{ogcLabelMap[val] || val}</Text>;
              }}
            />
            {todayStr && (
              <ReferenceLine
                x={todayStr}
                stroke="black"
                strokeWidth={2}
                strokeOpacity={ogcFit ? 0.25 : 0}
                strokeDasharray={'15 5'}
                label={
                  ogcFit
                    ? {
                        value: `Heute (${ogcData
                          .find(d => todayStr === d.date)
                          ?.fit.toFixed(2)})`,
                        position: 'top',
                        opacity: 0.25,
                      }
                    : ''
                }
              />
            )}
            <Scatter dataKey="omicron_rel" fill="#8884d8" />
            <Line dataKey="fit" dot={false} activeDot={false} fill="#3182bd" />
          </ComposedChart>
        </ResponsiveContainer>

        <Paragraph
          lineHeight={1.2}
          maxWidth={1024}
          paddingX={phone ? 8 : 64}
          marginTop={phone ? 64 : 32}
          textAlign={phone ? 'justify' : 'left'}
          marginX="auto"
        >
          Dargestellt sind die relativen Häufigkeiten der Omikron Variante
          (inkl. aller Subtypen), wie vom RKI im Rahmen der repräsentativen
          Surveillance berichtet. Die Größe der Kreise repräsentiert die Anzahl
          der Sequenzierungen dieses Tages. <br />
          Die durchgezogene Linie stellt die reine mathematische Modellierung
          dieses Wachstums anhand einer Sigmoid-Funktion dar. Die Extrapolation
          betrachtet keinerlei externe Faktoren.
        </Paragraph>
      </Card>

      {/* Absolute Case Chart */}
      <Card
        elevation={3}
        paddingY={16}
        paddingX={phone ? 4 : 32}
        margin={!phone ? 64 : undefined}
        marginY={phone ? 32 : 64}
      >
        <Heading textAlign="center" size={500} marginBottom={32}>
          Absoloute Fälle [pro Tag]
        </Heading>

        <Pane
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          flexDirection={phone ? 'column' : 'row'}
        >
          <Text
            marginRight={!phone ? 16 : undefined}
            marginBottom={phone ? 8 : undefined}
          >
            Projektion [Tage]
          </Text>
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

        <Pane
          display="flex"
          justifyContent={phone ? 'center' : 'flex-end'}
          marginY={phone ? 8 : undefined}
          alignItems="center"
        >
          <Checkbox
            checked={accShowActualCases}
            onChange={e => setAccShowActualCases(e.target.checked)}
          />
          <Text marginLeft={16}>Tatsächlich gemeldete Fallzahlen</Text>
        </Pane>

        <ResponsiveContainer width="100%" height={phone ? 400 : 500}>
          <ComposedChart
            width={800}
            height={phone ? 400 : 500}
            margin={{
              top: 20,
              right: 10,
              bottom: 20,
              left: 0,
            }}
            data={accData}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            {phone && <ZAxis range={[15, 15]} />}
            <ChartTooltip content={CustomTooltip('acc')} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              formatter={val => {
                return (
                  <Text
                    opacity={accOpacity[val]}
                    color="inherit"
                    cursor="pointer"
                  >
                    {accLabelMap[val] || val}
                  </Text>
                );
              }}
              onClick={handleClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
            {todayStr && (
              <ReferenceLine
                x={todayStr}
                stroke="black"
                strokeWidth={2}
                strokeOpacity={
                  accData[accData.length - 1].date > todayStr ? 0.25 : 0
                }
                strokeDasharray={'15 5'}
                label={
                  accData[accData.length - 1].date > todayStr
                    ? { value: 'Heute', position: 'top', opacity: 0.25 }
                    : ''
                }
              />
            )}
            {todayStr && (
              <ReferenceLine
                stroke="orange"
                strokeWidth={3}
                strokeOpacity={accForecastDays > 0 ? 1 : 0}
                label={
                  accForecastDays > 0
                    ? {
                        value: 'Extrapolation',
                        position: 'top',
                        fill: 'orange',
                      }
                    : ''
                }
                segment={[
                  { x: props.aggData[props.aggData.length - 1].date, y: 0 },
                  { x: accData[accData.length - 1].date, y: 0 },
                ]}
              />
            )}
            <Scatter
              dataKey="omicron_abs"
              fill="#8884d8"
              size
              fillOpacity={accOpacity['omicron_abs']}
            />
            <Scatter
              dataKey="delta_abs"
              fill="#dbbe00"
              fillOpacity={accOpacity['delta_abs']}
            />
            {accShowActualCases && (
              <Scatter
                dataKey="new_cases_smoothed"
                fill="#700036"
                fillOpacity={accOpacity['new_cases_smoothed']}
              />
            )}
            <Line
              dataKey="omicron_abs_fit"
              dot={false}
              activeDot={false}
              stroke="#8884d8"
              strokeOpacity={accOpacity['omicron_abs_fit']}
            />
            <Line
              dataKey="delta_abs_fit"
              dot={false}
              activeDot={false}
              stroke="#dbbe00"
              strokeOpacity={accOpacity['delta_abs_fit']}
            />
            <Line
              dataKey="new_cases_smoothed_fit"
              dot={false}
              activeDot={false}
              strokeWidth={phone ? 2 : 3}
              stroke="#700036"
              strokeOpacity={accOpacity['new_cases_smoothed_fit']}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card
        elevation={3}
        paddingY={16}
        paddingX={phone ? 4 : 32}
        margin={!phone ? 64 : undefined}
        marginY={phone ? 32 : 64}
      >
        <Heading textAlign="center" size={500} marginBottom={32}>
          Bullets
        </Heading>

        <Pane
          display="flex"
          justifyContent="space-evenly"
          alignItems={phone ? 'stretch' : 'center'}
          flexWrap={!phone ? 'wrap' : undefined}
          flexDirection={phone ? 'column' : 'row'}
          paddingX={phone ? 16 : undefined}
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
              marginBottom={phone ? 16 : 8}
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

      <Pane margin={!phone ? 64 : undefined} paddingX={phone ? 4 : 0}>
        <Heading>Quellen</Heading>
        <Text display="block">
          <a
            href="https://github.com/robert-koch-institut/SARS-CoV-2-Sequenzdaten_aus_Deutschland"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/robert-koch-institut/SARS-CoV-2-Sequenzdaten_aus_Deutschland
          </a>
        </Text>
        <Text display="block">
          <a
            href="https://github.com/owid/covid-19-data/tree/master/public/data"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/owid/covid-19-data/tree/master/public/data
          </a>
        </Text>
      </Pane>
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
