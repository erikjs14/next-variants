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
  Alert,
} from 'evergreen-ui';
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
import Head from 'next/head';

const logit = x => {
  const result = Math.log(x / (1 - x));
  if (result === Infinity) return NaN;
  else return result;
};
const sigmoid = x => Math.exp(x) / (1 + Math.exp(x));
const toPercentage = (x, fixed = 0) =>
  (x > 0 && x < 1 && (x < 0.01 || x > 0.99)) || fixed
    ? (x * 100).toFixed(fixed || 1) + '%'
    : (x * 100).toFixed() + '%';

export default function Analytics(props) {
  const [ogcLogit, setOgcLogit] = useState(true);
  const [ogcFit, setOgcFit] = useState(false);
  const [ogcShowStrains, setOgcShowStrains] = useState(false);

  const [accForecastDays, setAccForecastDays] = useState(14);
  const [accShowModeledCases, setAccShowModeledCases] = useState(true);

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
          d => new Date(d.date).getTime() >= new Date('2021-11-15').getTime(),
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
          ba1_rel: d['ba1_rel'],
          ba2_rel: d['ba2_rel'],
          ba3_rel: d['ba3_rel'],
          delta_rel: d['delta_rel'],
          sum: d.sum,
          fit:
            d.fit ||
            props.projectionOmicronGrowth.find(p => p.date === d.date)?.fit,
          ba2_rel_fit:
            d['ba2_rel_fit'] ||
            props.projectionBa2Growth.find(p => p.date === d.date)?.fit,
        }))
        .map(d => ({
          ...d,
          omicron_rel:
            d.sum < 10
              ? undefined
              : ogcLogit
              ? logit(d.omicron_rel || undefined)
              : d.omicron_rel,
          ba1_rel:
            d.sum < 10 || d.ba1_rel === 0
              ? undefined
              : ogcLogit
              ? logit(d.ba1_rel || undefined)
              : d.ba1_rel,
          ba2_rel:
            d.sum < 10 || d.ba2_rel === 0
              ? undefined
              : ogcLogit
              ? logit(d.ba2_rel || undefined)
              : d.ba2_rel,
          ba3_rel:
            d.sum < 10 || d.ba3_rel === 0
              ? undefined
              : ogcLogit
              ? logit(d.ba3_rel || undefined)
              : d.ba3_rel,
          delta_rel:
            d.sum < 10 || d.delta_rel === 0
              ? undefined
              : ogcLogit
              ? logit(d.delta_rel || undefined)
              : d.delta_rel,
          fit: ogcLogit ? logit(d.fit) : d.fit,
          ba2_rel_fit: ogcLogit ? logit(d.ba2_rel_fit) : d.ba2_rel_fit,
        })),
    [
      ogcFit,
      ogcLogit,
      props.aggData,
      props.projectionBa2Growth,
      props.projectionOmicronGrowth,
    ],
  );

  const ogcLabelMap = useMemo(
    () => ({
      date: 'Datum',
      omicron_rel: 'Omikron [relativ]',
      ba1_rel: 'BA.1 [relativ]',
      ba2_rel: 'BA.2 [relativ]',
      ba3_rel: 'BA.3 [relativ]',
      delta_rel: 'Delta [relativ]',
      sum: 'Anzahl Sequenzierungen',
      fit: 'Modelliertes Wachstum',
      ba2_rel_fit: 'Modelliertes BA.2 Wachstum',
    }),
    [],
  );
  const [ogcOpacity, setOgcOpacity] = useState(
    (() => {
      const init = {};
      for (let key of Object.keys(ogcLabelMap)) {
        init[key] = 1;
      }
      init['ba2_rel_fit'] = 0.1;
      return init;
    })(),
  );
  const ogcHandleMouseEnter = o => {
    setOgcOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 0.5 : 0.1,
    }));
  };
  const ogcHandleMouseLeave = o => {
    setOgcOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 1 : 0.1,
    }));
  };
  const ogcHandleClick = o => {
    setOgcOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 0.1 : 0.5,
    }));
  };

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
          incidence_smoothed_fit:
            ((d.new_cases_smoothed_fit * 7) / 83240000) * 100000,
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
      incidence_smoothed_fit: '7-Tage-Inzidenz',
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
  const accHandleMouseEnter = o => {
    setAccOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 0.5 : 0.1,
    }));
  };
  const accHandleMouseLeave = o => {
    setAccOpacity(prev => ({
      ...prev,
      [o.value]: prev[o.value] > 0.1 ? 1 : 0.1,
    }));
  };
  const accHandleClick = o => {
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

          if (ogcLogit) {
            const fitIdx = pl.findIndex(d => d.name === 'fit');
            const ba2FitIdx = pl.findIndex(d => d.name === 'ba2_rel_fit');
            const relIdx = pl.findIndex(d => d.name === 'omicron_rel');
            const ba1RelIdx = pl.findIndex(d => d.name === 'ba1_rel');
            const ba2RelIdx = pl.findIndex(d => d.name === 'ba2_rel');
            const ba3RelIdx = pl.findIndex(d => d.name === 'ba3_rel');
            const deltaRelIdx = pl.findIndex(d => d.name === 'delta_rel');
            const idc = [
              fitIdx,
              ba2FitIdx,
              relIdx,
              ba1RelIdx,
              ba2RelIdx,
              ba3RelIdx,
              deltaRelIdx,
            ];
            pl = pl.map((d, idx) => {
              if (idc.some(i => i === idx)) {
                return {
                  ...d,
                  value: sigmoid(d.value),
                };
              } else {
                return d;
              }
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
            {pl.map(d =>
              d?.value || d.value === 0 ? (
                <Pane
                  key={d.name}
                  display="flex"
                  justifyContent="space-between"
                  color={d.color}
                >
                  <Text color="inherit">{labelMap[d.name] || d.name}:</Text>
                  <Text color="inherit" marginLeft={16} fontFamily="mono">
                    {d.noDec
                      ? d.value.toFixed()
                      : type === 'ogc'
                      ? toPercentage(d.value, 4)
                      : d.value.toFixed(2)}
                  </Text>
                </Pane>
              ) : null,
            )}
          </Pane>
        );
      }

      return null;
    };

  return (
    <>
      <Pane>
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
              Logit
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

          <Pane
            display="flex"
            justifyContent={phone ? 'center' : 'flex-end'}
            marginTop={8}
            alignItems="center"
          >
            <Checkbox
              checked={ogcShowStrains}
              onChange={e => setOgcShowStrains(e.target.checked)}
              label={<Text marginLeft={16}>Zeige Alles</Text>}
            />
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
                scale={ogcLogit ? 'linear' : 'linear'}
                domain={ogcLogit ? [-8, 8] : [-0.1, 1]}
                ticks={
                  ogcLogit
                    ? [0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999].map(logit)
                    : []
                }
                tickFormatter={val =>
                  ogcLogit ? toPercentage(sigmoid(val)) : toPercentage(val)
                }
              />
              <ZAxis
                dataKey="sum"
                type="number"
                range={phone ? [10, 80] : [30, 200]}
              />
              <ChartTooltip content={CustomTooltip('ogc')} />
              <Legend
                layout={'horizontal'}
                align="center"
                verticalAlign="bottom"
                wrapperStyle={{
                  position: 'relative',
                  paddingLeft: phone ? 30 : undefined,
                }}
                formatter={val => {
                  return (
                    <Text
                      opacity={ogcOpacity[val]}
                      color="inherit"
                      cursor="pointer"
                    >
                      {ogcLabelMap[val] || val}
                    </Text>
                  );
                }}
                onClick={ogcHandleClick}
                onMouseEnter={ogcHandleMouseEnter}
                onMouseLeave={ogcHandleMouseLeave}
              />
              {todayStr && (
                <ReferenceLine
                  x={props.archive || todayStr}
                  stroke="black"
                  strokeWidth={2}
                  strokeOpacity={ogcFit ? 0.25 : 0}
                  strokeDasharray={'15 5'}
                  label={
                    ogcFit
                      ? {
                          value: `Heute (${(() => {
                            const d = ogcData.find(
                              d => todayStr === d.date,
                            )?.fit;
                            return toPercentage(ogcLogit ? sigmoid(d) : d);
                          })()})`,
                          position: 'top',
                          opacity: 0.25,
                        }
                      : ''
                  }
                />
              )}
              <Scatter
                dataKey="omicron_rel"
                fill="#8884d8"
                fillOpacity={ogcOpacity['omicron_rel']}
              />
              <Scatter
                dataKey="delta_rel"
                fill="#bbb"
                fillOpacity={0.25 * ogcOpacity['delta_rel']}
              />
              {ogcShowStrains && (
                <Scatter
                  dataKey="ba1_rel"
                  fill="#005fa3"
                  opacity={0.9}
                  fillOpacity={ogcOpacity['ba1_rel']}
                />
              )}
              <Scatter
                dataKey="ba2_rel"
                fill="#f55a00"
                opacity={0.9}
                fillOpacity={ogcOpacity['ba2_rel']}
              />
              {ogcShowStrains && (
                <>
                  <Line
                    dataKey="ba2_rel_fit"
                    dot={false}
                    activeDot={false}
                    stroke="#f55a00"
                    strokeOpacity={ogcOpacity['ba2_rel_fit']}
                  />
                  <Scatter
                    dataKey="ba3_rel"
                    fill="#00994f"
                    opacity={0.9}
                    fillOpacity={ogcOpacity['ba3_rel']}
                  />
                </>
              )}
              <Line
                dataKey="fit"
                dot={false}
                activeDot={false}
                stroke="#8884d8"
                strokeOpacity={ogcOpacity['fit']}
              />
            </ComposedChart>
          </ResponsiveContainer>

          <Paragraph
            lineHeight={1.2}
            maxWidth={1024}
            paddingX={phone ? 8 : 64}
            marginTop={phone ? 80 : 32}
            textAlign={phone ? 'justify' : 'left'}
            marginX="auto"
          >
            Dargestellt sind die relativen Häufigkeiten der Omikron Variante
            (inkl. aller Subtypen) an den Gesamtinfektionen, wie vom RKI im
            Rahmen der repräsentativen Surveillance berichtet. Die Größe der
            Kreise repräsentiert die Anzahl der Sequenzierungen dieses Tages.{' '}
            <br />
            Die durchgezogene Linie stellt die reine mathematische Modellierung
            dieses Wachstums anhand einer Sigmoid-Funktion dar. Die
            Extrapolation betrachtet keinerlei externe Faktoren.
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
              checked={accShowModeledCases}
              onChange={e => setAccShowModeledCases(e.target.checked)}
              label={<Text marginLeft={16}>Zeige Modellierung</Text>}
            />
          </Pane>

          <ResponsiveContainer width="100%" height={phone ? 400 : 500}>
            <ComposedChart
              width={800}
              height={phone ? 400 : 500}
              margin={{
                top: 40,
                right: phone ? 0 : 10,
                bottom: 20,
                left: phone ? 0 : 10,
              }}
              data={accData}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                yAxisId="lefty"
                label={
                  phone
                    ? {
                        value: 'Neuinf.',
                        position: 'top',
                        offset: 30,
                      }
                    : {
                        value: 'Tägl. Neuinfektionen',
                        position: 'left',
                        angle: -90,
                        offset: 20,
                      }
                }
              ></YAxis>
              <YAxis
                yAxisId="righty"
                orientation="right"
                label={
                  phone
                    ? {
                        value: 'Inz.',
                        position: 'top',
                        offset: 30,
                      }
                    : {
                        value: '7-Tage-Inzidenz',
                        position: 'right',
                        angle: 90,
                      }
                }
              />
              {phone && <ZAxis range={[15, 15]} />}
              <ChartTooltip content={CustomTooltip('acc')} />
              <Legend
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                formatter={val => {
                  return (
                    val !== 'incidence_smoothed_fit' && (
                      <Text
                        opacity={accOpacity[val]}
                        color="inherit"
                        cursor="pointer"
                      >
                        {accLabelMap[val] || val}
                      </Text>
                    )
                  );
                }}
                onClick={accHandleClick}
                onMouseEnter={accHandleMouseEnter}
                onMouseLeave={accHandleMouseLeave}
              />
              {todayStr && (
                <ReferenceLine
                  x={props.archive || todayStr}
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
                  yAxisId="lefty"
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
                  yAxisId="lefty"
                />
              )}
              <Scatter
                dataKey="omicron_abs"
                fill="#8884d8"
                size
                fillOpacity={accOpacity['omicron_abs']}
                yAxisId="lefty"
              />
              <Scatter
                dataKey="delta_abs"
                fill="#dbbe00"
                fillOpacity={accOpacity['delta_abs']}
                yAxisId="lefty"
              />
              <Scatter
                dataKey="new_cases_smoothed"
                fill="#700036"
                fillOpacity={accOpacity['new_cases_smoothed']}
                yAxisId="lefty"
              />
              {accShowModeledCases && (
                <>
                  <Line
                    dataKey="omicron_abs_fit"
                    dot={false}
                    activeDot={false}
                    stroke="#8884d8"
                    strokeOpacity={accOpacity['omicron_abs_fit']}
                    yAxisId="lefty"
                  />
                  <Line
                    dataKey="delta_abs_fit"
                    dot={false}
                    activeDot={false}
                    stroke="#dbbe00"
                    strokeOpacity={accOpacity['delta_abs_fit']}
                    yAxisId="lefty"
                  />
                  <Line
                    dataKey="new_cases_smoothed_fit"
                    dot={false}
                    activeDot={false}
                    strokeWidth={phone ? 2 : 3}
                    stroke="#700036"
                    strokeOpacity={accOpacity['new_cases_smoothed_fit']}
                    yAxisId="lefty"
                  />
                </>
              )}
              <Scatter
                dataKey="incidence_smoothed_fit"
                fill="#700036"
                fillOpacity={0}
                legendType="none"
                yAxisId="righty"
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
                <Heading is="span" marginY={16} size={900} position="relative">
                  {sdp.value}
                  {sdp.change && (
                    <Text
                      size={300}
                      opacity={0.6}
                      position="absolute"
                      top={0}
                      right={-8}
                      transform="translateX(100%)"
                    >
                      {sdp.change}
                    </Text>
                  )}
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
    </>
  );
}
