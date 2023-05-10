import * as dotenv from "dotenv";
dotenv.config();

import React, { useEffect, useState } from 'react';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { render, Text, Box, Spacer, Newline } from 'ink';
import { Subscription } from "@atproto/xrpc-server";
import pkg from "@atproto/api";
import { WriteOpAction, cborToLexRecord, readCarWithRoot } from "@atproto/repo";
import { Commit } from "@atproto/api/dist/client/types/com/atproto/sync/subscribeRepos.js";
import { is } from "@atproto/common-web/dist/check.js";
const { AtUri } = pkg;

export default function App() {
	const [count, setCount] = useState(0);
	const [countSinceLast, setCountSinceLast] = useState(0);
	const [postCount, setPostCount] = useState(0);
	const [likeCount, setLikeCount] = useState(0);
	const [followCount, setFollowCount] = useState(0);
	const [repo, setRepo] = useState("bsky.social");
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState(null);
	const [messages, setMessages] = useState([]);
	const [lastMessage, setLastMessage] = useState(null);
	const [lastNonEmptyMessage, setLastNonEmptyMessage] = useState(null);
	const [startTime, setStartTime] = useState(null);

	const sub = new Subscription({
		service: 'wss://bsky.social',
		method: "com.atproto.sync.subscribeRepos",
		validate: (body) => body,
	});

	const stream = async () => {
		for await (const frameBody of sub) {
			setIsConnected(true);
			try {
				const commit = frameBody as Commit;
				const car = await readCarWithRoot(commit.blocks);
				const ops = [];
				commit.ops.forEach((op) => {
					setCount((prevCount) => prevCount + 1);
					setCountSinceLast((prevCount) => prevCount + 1);

					// This section mostly minics the code in repo.getOps()
					const [collection, rkey] = op.path.split("/");
					if (
						op.action === WriteOpAction.Create ||
						op.action === WriteOpAction.Update
					) {
						const cid = op.cid;
						const record = car.blocks.get(cid);
						ops.push({
							action: op.action,
							cid: op.cid.toString(),
							record: cborToLexRecord(record),
							blobs: [], // @TODO need to determine how the app-view provides URLs for processed blobs
							uri: AtUri.make(commit.repo, collection, rkey).toString(),
						});
					} else if (op.action === WriteOpAction.Delete) {
						ops.push({
							action: op.action,
							uri: AtUri.make(commit.repo, collection, rkey).toString(),
						});
					} else {
						console.warn(`ERROR: Unknown repo op action: ${op.action}`);
					}
					// ops.forEach((op) => console.log(JSON.stringify(op, null, 2)));

					ops.forEach((op) => {
						// console.log(JSON.stringify(op, null, 2))
						setLastMessage(op);
						if (op.record?.text) {
							// console.log("Setting last non empty message: ", op.record.text);
							setLastNonEmptyMessage(op.record.text);
						}

						if (op.record?.$type === "app.bsky.feed.like") {
							setLikeCount((prevCount) => prevCount + 1);
						}

						if (op.record?.$type === "app.bsky.feed.post") {
							setPostCount((prevCount) => prevCount + 1);
						}

						if (op.record?.$type === "app.bsky.graph.follow") {
							setFollowCount((prevCount) => prevCount + 1);
						}
					});
				});
			} catch (err) {
				console.error("Unable to process frameBody", frameBody, err);
				setError(err);
			}
		}
	}

	useEffect(() => {
		setStartTime(Date.now());
		stream();
	}, []);

	useEffect(() => {
		// console.log("updating rate");
		const intervalId = setInterval(() => {
			// setRate(countSinceLast);
			setCountSinceLast(0); // reset 
		}, 1000);

		return () => clearInterval(intervalId);
	}, []);


	return (
		<Box flexDirection="column" padding={0}>
			<Box>
				<Text color={'blue'}>BlueSky Firehose</Text>
				{/* <Gradient name="rainbow">
					<BigText text="unicorns" />
				</Gradient> */}
			</Box>

			<Box flexDirection="column" borderStyle="double" margin={2}>
				<Box flexDirection="row" margin={0} justifyContent="flex-start">
					<Box borderStyle="round" margin={2}>
						{isConnected &&
							(<Text color={'green'}>Connected! </Text>) ||
							(<Text color={'red'}>Not Connected</Text>)}
					</Box>

					<Box borderStyle="round" margin={2}>
						<Text color={'yellow'}>Total Count: {count}</Text>
					</Box>

					<Box borderStyle="round" margin={2}>
						<Text color={'yellow'}>Posts: {postCount}</Text>
					</Box>

					<Box borderStyle="round" margin={2}>
						<Text color={'yellow'}>Likes: {likeCount}</Text>
					</Box>
					<Box borderStyle="round" margin={2}>
						<Text color={'yellow'}>Follows: {followCount}</Text>
					</Box>

					{error &&
						<Box borderStyle="round" margin={2}>
							<>
								<Text color={'red'}>Error: {error}</Text>
							</>
						</Box>
					}
				</Box>

				<Box borderStyle="single" margin={2}>
					<Text color={'green'}>Last message action: </Text>
					{lastMessage && <Text color={'blue'}>{lastMessage.action!}</Text>}
				</Box>

				<Box flexDirection="column" marginLeft={2}>
					<Text>Latest post:{'\n'}</Text>
					<Box borderStyle="round" marginTop={0} marginLeft={0} marginRight={2} height={10} wrap="truncate">
						{lastNonEmptyMessage && lastNonEmptyMessage.trim().length > 0 ? (
							<Text>{lastNonEmptyMessage}</Text>
						) : null}
					</Box>
				</Box>

				<Box marginTop={4} marginLeft={2} >
					<Box borderStyle="bold">
						<Text>Rate: {countSinceLast.toFixed(2)} ops/sec</Text>

					</Box>
					<Box borderStyle="bold">
						<Text color={'blue'}>Repo: {repo}</Text>
					</Box>
				</Box>
			</Box>
		</Box >
	);
}

render(<App />);
