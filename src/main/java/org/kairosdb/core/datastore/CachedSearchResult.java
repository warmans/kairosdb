/*
 * Copyright 2013 Proofpoint Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

package org.kairosdb.core.datastore;

import org.kairosdb.core.DataPoint;
import org.kairosdb.core.KairosDataPointFactory;
import org.kairosdb.util.BufferedDataInputStream;
import org.kairosdb.util.BufferedDataOutputStream;
import org.kairosdb.util.MemoryMonitor;
import org.kairosdb.util.StringPool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

public class CachedSearchResult implements QueryCallback
{
	public static final Logger logger = LoggerFactory.getLogger(CachedSearchResult.class);

	public static final int DATA_POINT_SIZE = 8 + 1 + 8; //timestamp + type flag + value
	public static final int MAX_READ_BUFFER_SIZE = 60; //The number of datapoints to read into each buffer we could potentially have a lot of these so we keep them smaller
	public static final int WRITE_BUFFER_SIZE = 500;

	public static final byte LONG_FLAG = 0x1;
	public static final byte DOUBLE_FLAG = 0x2;

	private String m_metricName;
	private List<FilePositionMarker> m_dataPointSets;
	private FilePositionMarker m_currentFilePositionMarker;
	private File m_dataFile;
	private RandomAccessFile m_randomAccessFile;
	private BufferedDataOutputStream m_dataOutputStream;

	private File m_indexFile;
	private AtomicInteger m_closeCounter = new AtomicInteger();
	private boolean m_readFromCache = false;
	private KairosDataPointFactory m_dataPointFactory;
	private StringPool m_stringPool;
	private int m_readBufferSize = MAX_READ_BUFFER_SIZE;


	private static File getIndexFile(String baseFileName)
	{
		String indexFileName = baseFileName + ".index";

		return (new File(indexFileName));
	}

	private static File getDataFile(String baseFileName)
	{
		String dataFileName = baseFileName+".data";

		return (new File(dataFileName));
	}

	private CachedSearchResult(String metricName, File dataFile, File indexFile,
			KairosDataPointFactory datatPointFactory)
			throws FileNotFoundException
	{
		m_metricName = metricName;
		/*m_writeBuffer = ByteBuffer.allocate(DATA_POINT_SIZE * WRITE_BUFFER_SIZE);
		m_writeBuffer.clear();*/
		m_indexFile = indexFile;
		m_dataPointSets = new ArrayList<FilePositionMarker>();
		m_dataFile = dataFile;
		m_dataPointFactory = datatPointFactory;
		m_stringPool = new StringPool();
	}

	private void openCacheFile() throws FileNotFoundException
	{
		//Cache cleanup could have removed the folders
		m_dataFile.getParentFile().mkdirs();
		m_randomAccessFile = new RandomAccessFile(m_dataFile, "rw");
		m_dataOutputStream = BufferedDataOutputStream.create(m_randomAccessFile, 0L);
	}


	/**
	 Reads the index file into memory
	 */
	private void loadIndex() throws IOException, ClassNotFoundException
	{
		ObjectInputStream in = new ObjectInputStream(new FileInputStream(m_indexFile));
		int size = in.readInt();
		int avgRowWidth = 0;
		for (int I = 0; I < size; I++)
		{
			//open the cache file only if there will be data point groups returned
			if (m_randomAccessFile == null)
				openCacheFile();

			FilePositionMarker marker = new FilePositionMarker();
			marker.readExternal(in);
			m_dataPointSets.add(marker);
			avgRowWidth += marker.getDataPointCount();
		}

		avgRowWidth /= size;

		m_readBufferSize = Math.min(m_readBufferSize, avgRowWidth);

		m_readFromCache = true;
		in.close();
	}

	private void saveIndex() throws IOException
	{
		if (m_readFromCache)
			return; //No need to save if we read it from the file

		ObjectOutputStream out = new ObjectOutputStream(new FileOutputStream(m_indexFile));

		//todo: write out a type lookup table

		out.writeInt(m_dataPointSets.size());
		for (FilePositionMarker marker : m_dataPointSets)
		{
			marker.writeExternal(out);
		}

		out.flush();
		out.close();
	}

	/*private void clearDataFile() throws IOException
	{
		if (m_randomAccessFile != null)
			m_randomAccessFile.getChannel().truncate(0);
	}*/

	public static CachedSearchResult createCachedSearchResult(String metricName,
			String baseFileName, KairosDataPointFactory dataPointFactory)
			throws IOException
	{
		File dataFile = getDataFile(baseFileName);
		File indexFile = getIndexFile(baseFileName);

		//Just in case the file are there.
		dataFile.delete();
		indexFile.delete();

		CachedSearchResult ret = new CachedSearchResult(metricName, dataFile,
				indexFile, dataPointFactory);

		//ret.clearDataFile();

		return (ret);
	}

	/**

	 @param baseFileName base name of file
	 @param cacheTime The number of seconds to still open the file
	 @return The CachedSearchResult if the file exists or null if it doesn't
	 */
	public static CachedSearchResult openCachedSearchResult(String metricName,
			String baseFileName, int cacheTime, KairosDataPointFactory dataPointFactory) throws IOException
	{
		CachedSearchResult ret = null;
		File dataFile = getDataFile(baseFileName);
		File indexFile = getIndexFile(baseFileName);
		long now = System.currentTimeMillis();

		if (dataFile.exists() && indexFile.exists() && ((now - dataFile.lastModified()) < ((long)cacheTime * 1000)))
		{

			ret = new CachedSearchResult(metricName, dataFile, indexFile, dataPointFactory);
			try
			{
				ret.loadIndex();
			}
			catch (ClassNotFoundException e)
			{
				logger.error("Unable to load cache file", e);
				ret = null;
			}
		}

		return (ret);
	}

	/**
	 Call when finished adding datapoints to the cache file
	 */
	public void endDataPoints() throws IOException
	{
		if (m_randomAccessFile == null)
			return;

		//flushWriteBuffer();
		m_dataOutputStream.flush();

		long curPosition = m_dataOutputStream.getPosition();
		if (m_dataPointSets.size() != 0)
			m_dataPointSets.get(m_dataPointSets.size() -1).setEndPosition(curPosition);
	}

	/**
	 Closes the underling file handle
	 */
	private void close()
	{
		try
		{
			if (m_randomAccessFile != null)
				m_randomAccessFile.close();

			saveIndex();
		}
		catch (IOException e)
		{
			logger.error("Failure closing cache file", e);
		}
	}

	protected void decrementClose()
	{
		if (m_closeCounter.decrementAndGet() == 0)
			close();
	}


	/**
	 A new set of datapoints to write to the file.  This causes the start position
	 of the set to be saved.  All inserted datapoints after this call are
	 expected to be in ascending time order and have the same tags.
	 */
	public void startDataPointSet(String type, Map<String, String> tags) throws IOException
	{
		if (m_randomAccessFile == null)
			openCacheFile();

		endDataPoints();

		long curPosition = m_dataOutputStream.getPosition();
		m_currentFilePositionMarker = new FilePositionMarker(curPosition, tags, type);
		m_dataPointSets.add(m_currentFilePositionMarker);
	}

	/*private void flushWriteBuffer() throws IOException
	{
		if (m_writeBuffer.position() != 0)
		{
			m_writeBuffer.flip();

			while (m_writeBuffer.hasRemaining())
				m_randomAccessFile.write(m_writeBuffer);

			m_writeBuffer.clear();
		}
	}*/

	/*public void addDataPoint(long timestamp, long value) throws IOException
	{
		if (!m_writeBuffer.hasRemaining())
		{
			flushWriteBuffer();
		}
		m_writeBuffer.putLong(timestamp);
		m_writeBuffer.put(LONG_FLAG);
		m_writeBuffer.putLong(value);

		m_currentFilePositionMarker.incrementDataPointCount();
	}

	public void addDataPoint(long timestamp, double value) throws IOException
	{
		if (!m_writeBuffer.hasRemaining())
		{
			flushWriteBuffer();
		}
		m_writeBuffer.putLong(timestamp);
		m_writeBuffer.put(DOUBLE_FLAG);
		m_writeBuffer.putDouble(value);

		m_currentFilePositionMarker.incrementDataPointCount();
	}*/

	@Override
	public void addDataPoint(DataPoint datapoint) throws IOException
	{
		/*if ((double)m_writeBuffer.remaining() < ((double)m_writeBuffer.limit() * 0.20))
		{
			flushWriteBuffer();
		}*/
		m_dataOutputStream.writeLong(datapoint.getTimestamp());
		//m_writeBuffer.putLong(datapoint.getTimestamp());
		datapoint.writeValueToBuffer(m_dataOutputStream);

		m_currentFilePositionMarker.incrementDataPointCount();
	}

	public List<DataPointRow> getRows()
	{
		//Calculate read buffer size
		int avgRowWidth = 1;
		for (FilePositionMarker marker : m_dataPointSets)
		{
			avgRowWidth += marker.getDataPointCount();
		}
		//todo: check for zero in m_dataPointSets
		if (m_dataPointSets.size() != 0)
		{
			avgRowWidth /= m_dataPointSets.size();

			m_readBufferSize = Math.min(avgRowWidth, MAX_READ_BUFFER_SIZE);

			//Try to max out at 100M
			m_readBufferSize = (int)Math.min(m_readBufferSize,
					(100000000L / (DATA_POINT_SIZE * m_dataPointSets.size())));
		}

		if (m_readBufferSize == 0)
			m_readBufferSize = 1;

		//System.out.println("Read Buffer size "+m_readBufferSize);

		List<DataPointRow> ret = new ArrayList<DataPointRow>();
		MemoryMonitor mm = new MemoryMonitor(20);

		for (FilePositionMarker dpSet : m_dataPointSets)
		{
			ret.add(dpSet.iterator());
			m_closeCounter.incrementAndGet();
			mm.checkMemoryAndThrowException();
		}

		return (ret);
	}

	//===========================================================================
	private class FilePositionMarker implements Iterable<DataPoint>, Externalizable
	{
		private long m_startPosition;
		private long m_endPosition;
		private Map<String, String> m_tags;
		private String m_dataType;
		private int m_dataPointCount;


		public FilePositionMarker()
		{
			m_startPosition = 0L;
			m_endPosition = 0L;
			m_tags = new HashMap<String, String>();
			m_dataType = null;
			m_dataPointCount = 0;
		}

		public FilePositionMarker(long startPosition, Map<String, String> tags,
				String dataType)
		{
			m_startPosition = startPosition;
			m_tags = tags;
			m_dataType = dataType;
		}

		public void setEndPosition(long endPosition)
		{
			m_endPosition = endPosition;
		}

		public Map<String, String> getTags()
		{
			return m_tags;
		}

		public void incrementDataPointCount()
		{
			m_dataPointCount ++;
		}

		public int getDataPointCount()
		{
			return m_dataPointCount;
		}

		@Override
		public CachedDataPointRow iterator()
		{
			return (new CachedDataPointRow(m_tags, m_startPosition, m_endPosition,
					m_dataType, m_dataPointCount));
		}

		@Override
		public void writeExternal(ObjectOutput out) throws IOException
		{
			out.writeLong(m_startPosition);
			out.writeLong(m_endPosition);
			out.writeObject(m_dataType);
			out.writeInt(m_tags.size());
			for (String s : m_tags.keySet())
			{
				out.writeObject(s);
				out.writeObject(m_tags.get(s));
			}
		}

		@Override
		public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException
		{
			m_startPosition = in.readLong();
			m_endPosition = in.readLong();
			m_dataType = (String)in.readObject();
			m_dataPointCount = (int)((m_endPosition - m_startPosition) / DATA_POINT_SIZE);

			int tagCount = in.readInt();
			for (int I = 0; I < tagCount; I++)
			{
				String key = m_stringPool.getString((String)in.readObject());
				String value = m_stringPool.getString((String)in.readObject());
				m_tags.put(key, value);
			}
		}
	}

	//===========================================================================
	private class CachedDataPointRow implements DataPointRow
	{
		private long m_currentPosition;
		private long m_endPostition;
		private DataInputStream m_readBuffer;
		private Map<String, String> m_tags;
		private final String m_dataType;
		private final int m_dataPointCount;
		private int m_dataPointsRead = 0;

		public CachedDataPointRow(Map<String, String> tags,
				long startPosition, long endPostition, String dataType, int dataPointCount)
		{
			m_currentPosition = startPosition;
			m_endPostition = endPostition;
			m_readBuffer = new BufferedDataInputStream(m_randomAccessFile, startPosition);
			//m_readBuffer = ByteBuffer.allocate(DATA_POINT_SIZE * m_readBufferSize);
			//m_readBuffer.clear();
			//m_readBuffer.limit(0);
			m_tags = tags;
			m_dataType = dataType;
			m_dataPointCount = dataPointCount;
		}

		/*private void readMorePoints() throws IOException
		{
			m_readBuffer.clear();

			if ((m_endPostition - m_currentPosition) < m_readBuffer.limit())
				m_readBuffer.limit((int)(m_endPostition - m_currentPosition));

			int sizeRead = m_randomAccessFile.read(m_readBuffer, m_currentPosition);
			if (sizeRead == -1)
				throw new IOException("Prematurely reached the end of the file");

			m_currentPosition += sizeRead;
			m_readBuffer.flip();
		}*/

		@Override
		public boolean hasNext()
		{
			return (m_dataPointsRead < m_dataPointCount);
			//return (m_readBuffer.hasRemaining() || m_currentPosition < m_endPostition);
		}

		@Override
		public DataPoint next()
		{
			DataPoint ret = null;

			try
			{
				/*if (!m_readBuffer.hasRemaining())
					readMorePoints();

				if (!m_readBuffer.hasRemaining())
					return (null);*/

				long timestamp = m_readBuffer.readLong();

				ret = m_dataPointFactory.createDataPoint(m_dataType, timestamp, m_readBuffer);

			}
			catch (IOException ioe)
			{
				logger.error("Error reading next data point.", ioe);
			}

			m_dataPointsRead ++;
			return (ret);
		}

		@Override
		public void remove()
		{
			throw new UnsupportedOperationException();
		}

		@Override
		public String getName()
		{
			return (m_metricName);
		}

		@Override
		public String getDatastoreType()
		{
			return m_dataType;
		}

		@Override
		public Set<String> getTagNames()
		{
			return (m_tags.keySet());
		}

		@Override
		public String getTagValue(String tag)
		{
			return (m_tags.get(tag));
		}

		@Override
		public void close()
		{
			decrementClose();
		}

		@Override
		public int getDataPointCount()
		{
			return m_dataPointCount;
		}

		@Override
		public String toString()
		{
			return "CachedDataPointRow{" +
					"m_metricName='" + m_metricName + '\'' +
					", m_tags=" + m_tags +
					'}';
		}
	}
}
